package com.changqingjing.admin.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.changqingjing.admin.api.staff.AdminStaffQuery;
import com.changqingjing.admin.api.staff.CreateAdminStaffRequest;
import com.changqingjing.admin.api.staff.ResetAdminPasswordRequest;
import com.changqingjing.admin.api.staff.UpdateAdminStaffRequest;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.auth.AdminRole;
import com.changqingjing.admin.auth.AdminStatus;
import com.changqingjing.common.api.BusinessException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "app.admin.password.bcrypt-strength=4")
@Testcontainers
class AdminStaffServiceIntegrationTest {

    private static final String ADMIN_PASSWORD = "SecurePassword2026";

    @Container
    private static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private AdminStaffService staffService;

    @Autowired
    private AdminBootstrapService bootstrapService;

    @Autowired
    private AdminAccountRepository accountRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_account CASCADE");
    }

    @Test
    void createsSearchesUpdatesAndResetsStaffCredentials() {
        AdminPrincipal actor = bootstrapAdmin("first.admin");
        var created = staffService.create(
                new CreateAdminStaffRequest(
                        "content.operator",
                        "内容运营",
                        AdminRole.OPERATOR,
                        "OperatorPassword2026"),
                actor,
                "staff-create");

        AdminStaffQuery query = new AdminStaffQuery();
        query.setKeyword("内容");
        assertThat(staffService.search(query).items())
                .extracting("id")
                .containsExactly(created.id());

        insertSession(created.loginName());
        var updated = staffService.update(
                created.id(),
                new UpdateAdminStaffRequest(
                        "内容编辑", AdminRole.OPERATOR, AdminStatus.DISABLED, created.version()),
                actor,
                "staff-update");
        assertThat(updated.status()).isEqualTo("DISABLED");
        assertThat(updated.version()).isEqualTo(1);
        assertThat(sessionCount(created.loginName())).isZero();

        insertSession(created.loginName());
        var reset = staffService.resetPassword(
                created.id(),
                new ResetAdminPasswordRequest("NewOperatorPassword2026", updated.version()),
                actor,
                "staff-password-reset");
        AdminAccount reloaded = accountRepository.findById(created.id()).orElseThrow();
        assertThat(reset.version()).isEqualTo(2);
        assertThat(passwordEncoder.matches(
                "NewOperatorPassword2026", reloaded.passwordHash())).isTrue();
        assertThat(sessionCount(created.loginName())).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM admin_audit_event WHERE target_id = ?",
                Long.class,
                created.id())).isEqualTo(3);
    }

    @Test
    void rejectsDuplicateLoginAndStaleUpdates() {
        AdminPrincipal actor = bootstrapAdmin("first.admin");
        var created = staffService.create(
                new CreateAdminStaffRequest(
                        "operator.one", "运营一", AdminRole.OPERATOR, "OperatorPassword2026"),
                actor,
                "staff-create");

        assertThatThrownBy(() -> staffService.create(
                new CreateAdminStaffRequest(
                        "OPERATOR.ONE", "运营二", AdminRole.OPERATOR, "AnotherPassword2026"),
                actor,
                "staff-duplicate"))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getCode())
                                .isEqualTo("LOGIN_NAME_CONFLICT"));

        staffService.update(
                created.id(),
                new UpdateAdminStaffRequest(
                        "已更新", AdminRole.OPERATOR, AdminStatus.ACTIVE, created.version()),
                actor,
                "staff-update");
        assertThatThrownBy(() -> staffService.update(
                created.id(),
                new UpdateAdminStaffRequest(
                        "过期修改", AdminRole.OPERATOR, AdminStatus.ACTIVE, created.version()),
                actor,
                "staff-stale"))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getCode())
                                .isEqualTo("STAFF_VERSION_CONFLICT"));
    }

    @Test
    void serializesConcurrentChangesThatWouldRemoveAllAdministrators() throws Exception {
        AdminPrincipal first = bootstrapAdmin("first.admin");
        var secondResponse = staffService.create(
                new CreateAdminStaffRequest(
                        "second.admin", "第二管理员", AdminRole.ADMIN, "SecondPassword2026"),
                first,
                "staff-create");
        AdminPrincipal second = new AdminPrincipal(
                secondResponse.id(),
                secondResponse.loginName(),
                secondResponse.displayName(),
                AdminRole.ADMIN,
                secondResponse.version(),
                Instant.now());
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<String>> results = List.of(
                    executor.submit(() -> disableAfter(start, first.accountId(), first, 0)),
                    executor.submit(() -> disableAfter(
                            start, secondResponse.id(), second, secondResponse.version())));
            start.countDown();

            assertThat(List.of(results.get(0).get(), results.get(1).get()))
                    .containsExactlyInAnyOrder("CHANGED", "LAST_ACTIVE_ADMIN");
        } finally {
            executor.shutdownNow();
        }
        assertThat(accountRepository.countActiveAdmins()).isEqualTo(1);
    }

    private String disableAfter(
            CountDownLatch start,
            UUID accountId,
            AdminPrincipal actor,
            long version) throws InterruptedException {
        start.await();
        try {
            staffService.update(
                    accountId,
                    new UpdateAdminStaffRequest(
                            null, AdminRole.OPERATOR, AdminStatus.ACTIVE, version),
                    actor,
                    "concurrent-admin-change");
            return "CHANGED";
        } catch (BusinessException exception) {
            return exception.getCode();
        }
    }

    private AdminPrincipal bootstrapAdmin(String loginName) {
        UUID id = bootstrapService.createFirstAdmin(
                loginName, "初始管理员", ADMIN_PASSWORD, "bootstrap");
        AdminAccount account = accountRepository.findById(id).orElseThrow();
        return new AdminPrincipal(
                id,
                account.loginNameNormalized(),
                account.displayName(),
                account.role(),
                account.lockVersion(),
                Instant.now());
    }

    private void insertSession(String loginName) {
        long now = System.currentTimeMillis();
        jdbcTemplate.update("""
                INSERT INTO spring_session (
                    primary_id, session_id, creation_time, last_access_time,
                    max_inactive_interval, expiry_time, principal_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID().toString(),
                UUID.randomUUID().toString(),
                now,
                now,
                1800,
                now + 1_800_000,
                loginName);
    }

    private long sessionCount(String loginName) {
        Long result = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM spring_session WHERE principal_name = ?",
                Long.class,
                loginName);
        return result == null ? 0 : result;
    }
}
