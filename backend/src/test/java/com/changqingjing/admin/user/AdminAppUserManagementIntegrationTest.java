package com.changqingjing.admin.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.verify;

import com.changqingjing.admin.api.user.AdminAppUserQuery;
import com.changqingjing.admin.api.user.UpdateAppUserStatusRequest;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.auth.AdminRole;
import com.changqingjing.app.api.profile.UpdateAppProfileRequest;
import com.changqingjing.app.auth.AppSessionService;
import com.changqingjing.app.user.AppProfileService;
import com.changqingjing.app.user.AppRegistrationService;
import com.changqingjing.app.user.AppUserStatus;
import com.changqingjing.app.wechat.WechatIdentityResult;
import com.changqingjing.app.wechat.WechatPhoneResult;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.media.MediaCleanupService;
import com.changqingjing.media.MediaStorage;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
        "app.admin.password.bcrypt-strength=4",
        "app.wechat.phone-encryption-key-base64=AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
        "app.media.cleanup.initial-delay-ms=3600000"
})
@AutoConfigureMockMvc
@Testcontainers
class AdminAppUserManagementIntegrationTest {
    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired private AdminAppUserService service;
    @Autowired private AdminBootstrapService bootstrap;
    @Autowired private AppRegistrationService registration;
    @Autowired private AppSessionService sessions;
    @Autowired private AppProfileService profiles;
    @Autowired private MediaCleanupService cleanup;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MockMvc mvc;
    @MockBean private MediaStorage storage;

    private AdminPrincipal actor;
    private final WechatIdentityResult identity = new WechatIdentityResult("test-app", "test-openid", null);
    private final WechatPhoneResult phone = new WechatPhoneResult("13800138000", "test-app");

    @BeforeEach
    void resetDatabase() {
        jdbc.execute("TRUNCATE TABLE admin_account, app_user CASCADE");
        UUID id = bootstrap.createFirstAdmin("test.admin", "测试管理员", "SecurePassword2026", "test-bootstrap");
        actor = new AdminPrincipal(id, "test.admin", "测试管理员", AdminRole.ADMIN, 0, Instant.now());
    }

    @Test
    void freezeInvalidatesEverySessionAndUnfreezeRequiresFreshLogin() throws Exception {
        var login = registration.register(identity, phone);
        var restored = registration.restore(identity);
        UUID id = login.user().id();
        var frozen = service.changeStatus(id, new UpdateAppUserStatusRequest(AppUserStatus.DISABLED, 0L), actor, "freeze");
        assertThat(frozen.status()).isEqualTo("DISABLED");
        assertThat(frozen.version()).isEqualTo(1);
        assertThat(frozen.maskedPhone()).isEqualTo(login.user().maskedPhone());
        assertThat(sessions.authenticate(login.accessToken())).isEmpty();
        assertThat(sessions.authenticate(restored.accessToken())).isEmpty();
        mvc.perform(get("/api/v1/app/me").header("Authorization", "Bearer " + login.accessToken()))
                .andExpect(status().isUnauthorized());
        assertCode(() -> registration.restore(identity), "APP_ACCOUNT_DISABLED");
        assertCode(() -> registration.register(identity, phone), "APP_ACCOUNT_DISABLED");
        assertCode(() -> profiles.update(id, new UpdateAppProfileRequest("绕过冻结")), "UNAUTHENTICATED");

        var unfrozen = service.changeStatus(id, new UpdateAppUserStatusRequest(AppUserStatus.ACTIVE, 1L), actor, "unfreeze");
        assertThat(unfrozen.status()).isEqualTo("ACTIVE");
        assertThat(unfrozen.version()).isEqualTo(2);
        assertThat(sessions.authenticate(login.accessToken())).isEmpty();
        var fresh = registration.restore(identity);
        assertThat(fresh.user().id()).isEqualTo(id);
        assertThat(sessions.authenticate(fresh.accessToken())).isPresent();
        assertThat(count("admin_audit_event", "target_id", id)).isEqualTo(2);
    }

    @Test
    void deleteRemovesPersonalBindingsAndCleansOwnedAvatarWithoutOrphaningCos() {
        var login = registration.register(identity, phone);
        UUID id = login.user().id();
        UUID mediaId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO media_asset (id, object_key, original_filename, media_type, content_type,
                    size_bytes, status, purpose, uploaded_by_app_user, upload_expires_at, etag, verified_at)
                VALUES (?, 'test/avatar-to-delete', 'avatar.png', 'IMAGE', 'image/png', 10,
                    'READY', 'APP_USER_AVATAR', ?, now() + interval '15 minutes', 'test-etag', now())
                """, mediaId, id);
        jdbc.update("UPDATE app_user SET avatar_media_id = ? WHERE id = ?", mediaId, id);
        service.delete(id, 0, actor, "delete");

        assertCode(() -> service.get(id), "APP_USER_NOT_FOUND");
        assertThat(service.search(new AdminAppUserQuery()).total()).isZero();
        assertThat(sessions.authenticate(login.accessToken())).isEmpty();
        assertThat(count("wechat_identity", "user_id", id)).isZero();
        assertThat(count("user_phone", "user_id", id)).isZero();
        assertThat(count("app_session", "user_id", id)).isZero();
        assertThat(jdbc.queryForMap("SELECT display_name, avatar_media_id, deleted_at FROM app_user WHERE id = ?", id))
                .containsEntry("display_name", null).containsEntry("avatar_media_id", null)
                .doesNotContainEntry("deleted_at", null);
        assertThat(jdbc.queryForObject("SELECT status FROM media_asset WHERE id = ?", String.class, mediaId)).isEqualTo("FAILED");
        cleanup.cleanExpiredUploads();
        verify(storage).delete("test/avatar-to-delete");
        assertThat(jdbc.queryForObject("SELECT status FROM media_asset WHERE id = ?", String.class, mediaId)).isEqualTo("DELETED");
        assertThat(count("admin_audit_event", "target_id", id)).isEqualTo(1);
        assertCode(() -> registration.restore(identity), "REGISTRATION_REQUIRED");
        assertCode(() -> profiles.update(id, new UpdateAppProfileRequest("已删除账号")), "UNAUTHENTICATED");
        var newLogin = registration.register(identity, phone);
        assertThat(newLogin.user().id()).isNotEqualTo(id);
        assertThat(service.search(new AdminAppUserQuery()).total()).isEqualTo(1);
        assertThat(sessions.authenticate(login.accessToken())).isEmpty();
    }

    @Test
    void staleOrMissingTargetsNeverDeleteOrChangeAccounts() {
        UUID id = registration.register(identity, phone).user().id();
        service.changeStatus(id, new UpdateAppUserStatusRequest(AppUserStatus.DISABLED, 0L), actor, "freeze");
        assertCode(() -> service.delete(id, 0, actor, "stale-delete"), "APP_USER_VERSION_CONFLICT");
        assertCode(() -> service.changeStatus(id, new UpdateAppUserStatusRequest(AppUserStatus.ACTIVE, 0L), actor, "stale-unfreeze"), "APP_USER_VERSION_CONFLICT");
        assertThat(service.get(id).status()).isEqualTo("DISABLED");
        assertThat(count("user_phone", "user_id", id)).isEqualTo(1);
        assertCode(() -> service.delete(UUID.randomUUID(), 0, actor, "missing"), "APP_USER_NOT_FOUND");
        service.delete(id, 1, actor, "delete-frozen");
        assertCode(() -> service.delete(id, 1, actor, "repeated-delete"), "APP_USER_NOT_FOUND");
        assertCode(() -> service.changeStatus(id, new UpdateAppUserStatusRequest(AppUserStatus.ACTIVE, 1L), actor, "undelete"), "APP_USER_NOT_FOUND");
    }

    @Test
    void authorizationAndCsrfAreEnforcedForBothWriteEndpoints() throws Exception {
        UUID id = registration.register(identity, phone).user().id();
        var admin = auth(actor);
        var operator = auth(new AdminPrincipal(actor.accountId(), actor.loginName(), actor.displayName(), AdminRole.OPERATOR, 0, Instant.now()));
        String route = "/api/v1/admin/users/" + id;
        String body = "{\"status\":\"DISABLED\",\"expectedVersion\":0}";
        mvc.perform(patch(route + "/status").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mvc.perform(delete(route).param("expectedVersion", "0").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(patch(route + "/status").with(admin).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(delete(route).param("expectedVersion", "0").with(admin)).andExpect(status().isForbidden());
        mvc.perform(patch(route + "/status").with(operator).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(delete(route).param("expectedVersion", "0").with(operator).with(csrf())).andExpect(status().isForbidden());
        assertThat(service.get(id).status()).isEqualTo("ACTIVE");
        assertCode(() -> service.delete(id, 0, new AdminPrincipal(actor.accountId(), actor.loginName(), actor.displayName(), AdminRole.OPERATOR, 0, Instant.now()), "operator"), "ACCESS_DENIED");
    }

    @Test
    void administratorHttpActionsValidateVersionAndReflectDeletion() throws Exception {
        UUID id = registration.register(identity, phone).user().id();
        String route = "/api/v1/admin/users/" + id;
        mvc.perform(patch(route + "/status").with(auth(actor)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DISABLED\",\"expectedVersion\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DISABLED"))
                .andExpect(jsonPath("$.data.version").value(1));
        mvc.perform(delete(route).with(auth(actor)).with(csrf()).param("expectedVersion", "0"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("APP_USER_VERSION_CONFLICT"));
        mvc.perform(delete(route).with(auth(actor)).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(delete(route).with(auth(actor)).with(csrf()).param("expectedVersion", "-1")).andExpect(status().isBadRequest());
        mvc.perform(patch(route + "/status").with(auth(actor)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DISABLED\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete(route).with(auth(actor)).with(csrf()).param("expectedVersion", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").value("deleted"));
        mvc.perform(get(route).with(auth(actor))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/admin/users").with(auth(actor))).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0));
    }

    @Test
    void auditFailureRollsBackDeletionAndPreservesLogin() {
        var login = registration.register(identity, phone);
        var invalidActor = new AdminPrincipal(UUID.randomUUID(), "invalid.admin", "测试", AdminRole.ADMIN, 0, Instant.now());
        assertThatThrownBy(() -> service.delete(login.user().id(), 0, invalidActor, "audit-rollback"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(service.get(login.user().id()).status()).isEqualTo("ACTIVE");
        assertThat(count("user_phone", "user_id", login.user().id())).isEqualTo(1);
        assertThat(sessions.authenticate(login.accessToken())).isPresent();
    }

    @Test
    void concurrentStatusChangesAllowOnlyOneMatchingVersion() throws Exception {
        UUID id = registration.register(identity, phone).user().id();
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> freezeAfter(start, id));
            var second = executor.submit(() -> freezeAfter(start, id));
            start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder("CHANGED", "APP_USER_VERSION_CONFLICT");
        } finally {
            executor.shutdownNow();
        }
        assertThat(service.get(id).version()).isEqualTo(1);
    }

    private String freezeAfter(CountDownLatch start, UUID id) throws InterruptedException {
        start.await();
        try {
            service.changeStatus(id, new UpdateAppUserStatusRequest(AppUserStatus.DISABLED, 0L), actor, "concurrent");
            return "CHANGED";
        } catch (BusinessException exception) {
            return exception.getCode();
        }
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor auth(AdminPrincipal principal) {
        return authentication(new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name()))));
    }

    private long count(String table, String column, UUID id) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE " + column + " = ?", Long.class, id);
    }

    private void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable operation, String code) {
        assertThatThrownBy(operation).isInstanceOfSatisfying(BusinessException.class, error -> assertThat(error.getCode()).isEqualTo(code));
    }
}
