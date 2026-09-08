package com.changqingjing.admin.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "app.admin.password.bcrypt-strength=4")
@AutoConfigureMockMvc
@Testcontainers
class AdminAuthenticationIntegrationTest {

    private static final String LOGIN_NAME = "root.admin";
    private static final String PASSWORD = "SecurePassword2026";

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
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AdminBootstrapService bootstrapService;

    @Autowired
    private AdminLoginAttemptLimiter loginAttemptLimiter;

    @BeforeEach
    void resetDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_account CASCADE");
        loginAttemptLimiter.clear();
    }

    @Test
    void bootstrapsOnlyOneInitialAdministrator() {
        UUID accountId = bootstrapService.createFirstAdmin(
                LOGIN_NAME, "初始管理员", PASSWORD, "bootstrap-test");

        assertThat(accountId).isNotNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT role FROM admin_account WHERE id = ?",
                String.class,
                accountId)).isEqualTo("ADMIN");
        assertThatThrownBy(() -> bootstrapService.createFirstAdmin(
                "another.admin", "另一管理员", PASSWORD, "bootstrap-test-2"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already been completed");
    }

    @Test
    void requiresCsrfThenCreatesAndDestroysCookieSession() throws Exception {
        bootstrapDefaultAdmin();
        CsrfSession anonymous = csrf(null);

        MvcResult loginResult = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .cookie(anonymous.cookie())
                        .header(anonymous.headerName(), anonymous.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginName":"root.admin","password":"SecurePassword2026"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginName").value(LOGIN_NAME))
                .andExpect(jsonPath("$.data.role").value("ADMIN"))
                .andExpect(jsonPath("$.data.permissions[?(@ == 'staff:manage')]").exists())
                .andReturn();

        Cookie authenticatedCookie = requireSessionCookie(loginResult);
        mockMvc.perform(get("/api/v1/admin/auth/me").cookie(authenticatedCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.displayName").value("初始管理员"));

        CsrfSession authenticated = csrf(authenticatedCookie);
        mockMvc.perform(post("/api/v1/admin/auth/logout")
                        .cookie(authenticated.cookie())
                        .header(authenticated.headerName(), authenticated.token()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/auth/me").cookie(authenticated.cookie()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsLoginWithoutCsrfAndUsesGenericCredentialError() throws Exception {
        bootstrapDefaultAdmin();

        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginName":"root.admin","password":"SecurePassword2026"}
                                """))
                .andExpect(status().isForbidden());

        CsrfSession anonymous = csrf(null);
        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .cookie(anonymous.cookie())
                        .header(anonymous.headerName(), anonymous.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginName":"missing.admin","password":"WrongPassword2026"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("账号或密码不正确"));
    }

    @Test
    void limitsRepeatedLoginFailures() throws Exception {
        bootstrapDefaultAdmin();
        CsrfSession anonymous = csrf(null);

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/v1/admin/auth/login")
                            .cookie(anonymous.cookie())
                            .header(anonymous.headerName(), anonymous.token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"loginName":"root.admin","password":"WrongPassword2026"}
                                    """))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .cookie(anonymous.cookie())
                        .header(anonymous.headerName(), anonymous.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginName":"root.admin","password":"SecurePassword2026"}
                                """))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("LOGIN_RATE_LIMITED"));
    }

    @Test
    void invalidatesSessionWhenAccountVersionChanges() throws Exception {
        UUID accountId = bootstrapDefaultAdmin();
        Cookie authenticatedCookie = login();

        jdbcTemplate.update("""
                UPDATE admin_account
                SET status = 'DISABLED', lock_version = lock_version + 1
                WHERE id = ?
                """, accountId);

        mockMvc.perform(get("/api/v1/admin/auth/me").cookie(authenticatedCookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    private UUID bootstrapDefaultAdmin() {
        return bootstrapService.createFirstAdmin(
                LOGIN_NAME, "初始管理员", PASSWORD, "bootstrap-test");
    }

    private Cookie login() throws Exception {
        CsrfSession anonymous = csrf(null);
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .cookie(anonymous.cookie())
                        .header(anonymous.headerName(), anonymous.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginName":"root.admin","password":"SecurePassword2026"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        return requireSessionCookie(result);
    }

    private CsrfSession csrf(Cookie sessionCookie) throws Exception {
        var request = get("/api/v1/admin/auth/csrf");
        if (sessionCookie != null) {
            request.cookie(sessionCookie);
        }
        MvcResult result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).get("data");
        Cookie responseCookie = result.getResponse().getCookie("SESSION");
        return new CsrfSession(
                responseCookie == null ? sessionCookie : responseCookie,
                data.get("headerName").asText(),
                data.get("token").asText());
    }

    private Cookie requireSessionCookie(MvcResult result) {
        Cookie cookie = result.getResponse().getCookie("SESSION");
        assertThat(cookie).as("Spring Session cookie").isNotNull();
        return cookie;
    }

    private record CsrfSession(Cookie cookie, String headerName, String token) {
    }
}
