package com.changqingjing.config;

import static org.hamcrest.Matchers.matchesPattern;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.changqingjing.app.auth.AppPrincipal;
import com.changqingjing.app.auth.AppTokenAuthenticator;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminAuthService;
import com.changqingjing.admin.staff.AdminStaffService;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest
@Import({SecurityConfig.class, ApiTraceFilter.class, SecurityBoundaryTest.SecurityTestController.class})
class SecurityBoundaryTest {

    private static final String UUID_PATTERN =
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    private static final UUID APP_USER_ID = UUID.fromString("3bd74129-49ff-47b8-a464-1124d2f80b27");

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AppTokenAuthenticator tokenAuthenticator;

    @MockBean
    private AdminAccountRepository adminAccountRepository;

    @MockBean
    private AdminAuthService adminAuthService;

    @MockBean
    private AdminStaffService adminStaffService;

    @BeforeEach
    void configureAppToken() {
        when(tokenAuthenticator.authenticate("valid-app-token"))
                .thenReturn(Optional.of(new AppPrincipal(APP_USER_ID)));
    }

    @Test
    void protectedAppApiRequiresBearerToken() throws Exception {
        mockMvc.perform(get("/api/v1/app/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.traceId", matchesPattern(UUID_PATTERN)));
    }

    @Test
    void validBearerTokenAuthenticatesAppUser() throws Exception {
        mockMvc.perform(get("/api/v1/app/me")
                        .header("Authorization", "Bearer valid-app-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(APP_USER_ID.toString()));
    }

    @Test
    void scenicViewCanBeReportedAnonymously() throws Exception {
        mockMvc.perform(post("/api/v1/app/scenics/42/views"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("counted"));
    }

    @Test
    void adminCookieCannotAuthenticateAppApi() throws Exception {
        mockMvc.perform(get("/api/v1/app/me").session(adminSession("ADMIN")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void appBearerTokenCannotAuthenticateAdminApi() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .header("Authorization", "Bearer valid-app-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void operatorCannotReadRegisteredUsers() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users").session(adminSession("OPERATOR")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void operatorCannotManageStaff() throws Exception {
        mockMvc.perform(get("/api/v1/admin/staff").session(adminSession("OPERATOR")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void adminCookieAuthenticatesAdminApi() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users").session(adminSession("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("admin"));
    }

    @Test
    void unknownAdminApiIsDeniedForAuthenticatedAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/admin/unknown").session(adminSession("ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void adminWriteRequiresCsrfToken() throws Exception {
        mockMvc.perform(post("/api/v1/admin/contents").session(adminSession("ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(post("/api/v1/admin/contents")
                        .session(adminSession("ADMIN"))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("saved"));
    }

    private MockHttpSession adminSession(String role) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                "admin",
                "",
                java.util.List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                context);
        return session;
    }

    @RestController
    static class SecurityTestController {

        @GetMapping("/api/v1/app/me")
        ApiResponse<String> appMe(java.security.Principal principal) {
            return ApiResponse.of(principal.getName());
        }

        @GetMapping("/api/v1/admin/users")
        ApiResponse<String> adminUsers() {
            return ApiResponse.of("admin");
        }

        @PostMapping("/api/v1/app/scenics/{id}/views")
        ApiResponse<String> reportScenicView() {
            return ApiResponse.of("counted");
        }

        @PostMapping("/api/v1/admin/contents")
        ApiResponse<String> saveContent() {
            return ApiResponse.of("saved");
        }
    }
}
