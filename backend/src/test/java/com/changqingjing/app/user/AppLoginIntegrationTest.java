package com.changqingjing.app.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.changqingjing.app.wechat.WechatIdentityResult;
import com.changqingjing.app.wechat.WechatPhoneResult;
import com.changqingjing.common.api.BusinessException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
        "app.wechat.mock-enabled=true",
        "app.wechat.phone-encryption-key-base64=AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
        "app.wechat.session-ttl=7d"
})
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Testcontainers
class AppLoginIntegrationTest {

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
    private AppLoginService loginService;

    @Autowired
    private AppRegistrationService registrationService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE app_user CASCADE");
    }

    @Test
    void registersOnceRestoresSessionAndNeverStoresRawTokenOrPhone() throws Exception {
        String response = mockMvc.perform(post("/api/v1/app/auth/wechat/register-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginCode\":\"fresh-login-code\",\"phoneCode\":\"fresh-phone-code\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.phoneBound").value(true))
                .andExpect(jsonPath("$.data.user.maskedPhone").value("138****8000"))
                .andExpect(jsonPath("$.data.user.profileSetupRequired").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);

        String rawToken = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(response).at("/data/accessToken").asText();
        mockMvc.perform(get("/api/v1/app/me")
                        .header("Authorization", "Bearer " + rawToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.maskedPhone").value("138****8000"));

        mockMvc.perform(patch("/api/v1/app/me/profile")
                        .header("Authorization", "Bearer " + rawToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"山水旅人\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.displayName").value("山水旅人"))
                .andExpect(jsonPath("$.data.profileSetupRequired").value(false));

        var repeated = loginService.registerLogin("another-login-code", "another-phone-code");
        var restored = loginService.restore("restore-code");
        assertThat(repeated.user().id()).isEqualTo(restored.user().id());
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM app_user", Long.class))
                .isEqualTo(1L);

        byte[] storedPhone = jdbcTemplate.queryForObject(
                "SELECT phone_ciphertext FROM user_phone",
                byte[].class);
        byte[] storedToken = jdbcTemplate.queryForObject(
                "SELECT token_digest FROM app_session ORDER BY created_at LIMIT 1",
                byte[].class);
        assertThat(new String(storedPhone, StandardCharsets.UTF_8)).doesNotContain("13800138000");
        assertThat(Base64.getEncoder().encodeToString(storedToken)).isNotEqualTo(rawToken);

        mockMvc.perform(post("/api/v1/app/auth/logout")
                        .header("Authorization", "Bearer " + rawToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("logged-out"));
        mockMvc.perform(get("/api/v1/app/me")
                        .header("Authorization", "Bearer " + rawToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void restoreDoesNotCreateVisitorAndPhoneConflictDoesNotMergeAccounts() {
        assertThatThrownBy(() -> loginService.restore("unknown-code"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("REGISTRATION_REQUIRED");
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM app_user", Long.class))
                .isZero();

        var first = registrationService.register(
                new WechatIdentityResult("test-app", "openid-one", null),
                new WechatPhoneResult("13800138000", "test-app"));
        assertThatThrownBy(() -> registrationService.register(
                new WechatIdentityResult("test-app", "openid-two", null),
                new WechatPhoneResult("13800138000", "test-app")))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("PHONE_ALREADY_BOUND");
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM app_user", Long.class))
                .isEqualTo(1L);
        assertThat(first.user().id()).isNotNull();
    }

    @Test
    void rejectsAnonymousProfileAndInvalidRequestWithoutLoggingCredentials() throws Exception {
        mockMvc.perform(get("/api/v1/app/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(post("/api/v1/app/auth/logout"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/app/auth/wechat/register-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginCode\":\"\",\"phoneCode\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
