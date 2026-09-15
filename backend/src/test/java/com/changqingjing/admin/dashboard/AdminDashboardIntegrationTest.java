package com.changqingjing.admin.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.changqingjing.admin.audit.AdminAuditQueryService;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.auth.AdminRole;
import com.changqingjing.app.user.AppUserRepository;
import com.changqingjing.media.MediaService;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"app.admin.password.bcrypt-strength=4", "app.media.cleanup.initial-delay-ms=3600000"})
@AutoConfigureMockMvc
@Testcontainers
class AdminDashboardIntegrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired AppUserRepository users;
    @Autowired MediaService media;
    @Autowired AdminAuditQueryService audits;
    @Autowired AdminBootstrapService bootstrap;
    @Autowired MockMvc mvc;
    AdminPrincipal admin;
    AdminDashboardService fixedService;
    @BeforeEach void reset() {
        jdbc.execute("TRUNCATE TABLE admin_account, app_user CASCADE");
        UUID id = bootstrap.createFirstAdmin("dashboard.admin", "看板管理员", "SecurePassword2026", "dashboard-bootstrap");
        admin = new AdminPrincipal(id, "dashboard.admin", "看板管理员", AdminRole.ADMIN, 0, Instant.now());
        fixedService = new AdminDashboardService(jdbc, users, media, audits,
                Clock.fixed(Instant.parse("2026-09-15T00:30:00Z"), ZoneOffset.UTC));
    }

    @Test void respectsBeijingMidnightZeroFillsAndIncludesDeletedRegistrationHistory() {
        user("今日用户", "2026-09-14T16:00:00Z", false, false);
        user("昨天用户", "2026-09-14T15:59:59Z", false, false);
        user("冻结用户", "2026-09-10T00:00:00Z", true, false);
        user("已删除用户", "2026-09-15T00:00:00Z", true, true);
        user("较早用户", "2026-08-20T00:00:00Z", false, false);
        var result = fixedService.get(admin, 7);
        assertThat(result.statistics()).isEqualTo(new AdminDashboardResponse.Statistics(5, 2, 4, 1));
        assertThat(result.registrationTrend()).hasSize(7);
        assertThat(result.registrationTrend().get(0).date().toString()).isEqualTo("2026-09-09");
        assertThat(result.registrationTrend().get(0).count()).isZero();
        assertThat(result.registrationTrend().get(6).count()).isEqualTo(2);
        assertThat(result.recentUsers()).extracting(AdminDashboardResponse.RecentUser::displayName)
                .containsExactly("今日用户", "昨天用户", "冻结用户", "较早用户");
        assertThat(result.timezone()).isEqualTo("Asia/Shanghai");
        assertThat(fixedService.get(admin, 30).registrationTrend()).hasSize(30);
        jdbc.update("UPDATE app_user SET last_login_at = now()");
        assertThat(fixedService.get(admin, 7).statistics()).isEqualTo(result.statistics());
    }

    @Test void neverReturnsUserCountsOrProfilesToOperatorsAndScopesRecentOperations() throws Exception {
        UUID operatorId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO admin_account(id,login_name,login_name_normalized,password_hash,display_name,role,password_changed_at)
                SELECT ?,'dashboard.operator','dashboard.operator',password_hash,'运营','OPERATOR',now()
                FROM admin_account WHERE id = ?
            """, operatorId, admin.accountId());
        var operator = new AdminPrincipal(operatorId, "dashboard.operator", "运营", AdminRole.OPERATOR, 0, Instant.now());
        user("不可泄露的用户", "2026-09-15T00:00:00Z", false, false);
        jdbc.update("INSERT INTO admin_audit_event(id,actor_id,action,target_type,result,trace_id) VALUES (?,?,'COMPANY_DRAFT_SAVE','CONTENT_ENTRY','SUCCESS','operator-event')", UUID.randomUUID(), operatorId);
        var result = fixedService.get(operator, 7);
        assertThat(result.userMetricsVisible()).isFalse();
        assertThat(result.statistics()).isNull();
        assertThat(result.recentUsers()).isEmpty();
        assertThat(result.registrationTrend()).isEmpty();
        assertThat(result.recentOperations()).hasSize(1);
        assertThat(result.recentOperations().get(0).actorId()).isEqualTo(operatorId);
        mvc.perform(get("/api/v1/admin/dashboard").with(as(operator))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.statistics").doesNotExist()).andExpect(jsonPath("$.data.recentUsers").isEmpty());
        mvc.perform(get("/api/v1/admin/dashboard")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/dashboard").with(as(admin)).param("days", "14")).andExpect(status().isBadRequest());
    }

    @Test void emptyDatabaseIsReportedAsRealZerosAndRecentUsersAreLimitedToTen() {
        var empty = fixedService.get(admin, 7);
        assertThat(empty.statistics()).isEqualTo(new AdminDashboardResponse.Statistics(0, 0, 0, 0));
        assertThat(empty.registrationTrend()).allMatch(point -> point.count() == 0);
        for (int index = 0; index < 12; index++) user("注册用户" + index,
                "2026-09-15T00:" + String.format("%02d", index) + ":00Z", false, false);
        assertThat(fixedService.get(admin, 7).recentUsers()).hasSize(10);
        assertThat(fixedService.get(admin, 7).statistics().totalRegistrations()).isEqualTo(12);
    }

    @Test void anUnavailableAvatarFallsBackWithoutHidingCountsOrLeakingPhoneSecrets() {
        UUID userId = UUID.randomUUID(), mediaId = UUID.randomUUID();
        jdbc.update("INSERT INTO app_user(id,display_name,registered_at) VALUES (?,'头像用户','2026-09-15T00:00:00Z'::timestamptz)", userId);
        jdbc.update("""
            INSERT INTO media_asset(id,object_key,original_filename,media_type,content_type,size_bytes,
                purpose,status,uploaded_by_app_user,upload_expires_at,etag,verified_at)
                VALUES (?,?,'avatar.jpg','IMAGE','image/jpeg',1,'APP_USER_AVATAR','READY',?,now(),'etag',now())
            """, mediaId, "test/" + mediaId, userId);
        jdbc.update("UPDATE app_user SET avatar_media_id = ? WHERE id = ?", mediaId, userId);
        var result = fixedService.get(admin, 7);
        assertThat(result.statistics().todayRegistrations()).isEqualTo(1);
        assertThat(result.recentUsers().get(0).avatarUrl()).isNull();
    }
    void user(String name, String registered, boolean frozen, boolean deleted) {
        jdbc.update("INSERT INTO app_user(id,display_name,status,registered_at,deleted_at) VALUES (?,?,?,?,?)",
                UUID.randomUUID(), deleted ? null : name, frozen ? "DISABLED" : "ACTIVE",
                OffsetDateTime.parse(registered), deleted ? OffsetDateTime.parse("2026-09-15T00:20:00Z") : null);
    }
    org.springframework.test.web.servlet.request.RequestPostProcessor as(AdminPrincipal principal) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name()))));
    }
}
