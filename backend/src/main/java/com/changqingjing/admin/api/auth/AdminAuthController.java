package com.changqingjing.admin.api.auth;

import com.changqingjing.admin.auth.AdminAuthService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/auth")
public class AdminAuthController {

    private final AdminAuthService authService;
    private final HttpSessionSecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    public AdminAuthController(AdminAuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/csrf")
    public ApiResponse<AdminCsrfResponse> csrf(CsrfToken csrfToken) {
        return ApiResponse.of(new AdminCsrfResponse(
                csrfToken.getHeaderName(),
                csrfToken.getParameterName(),
                csrfToken.getToken()));
    }

    @PostMapping("/login")
    public ApiResponse<AdminMeResponse> login(
            @Valid @RequestBody AdminLoginRequest loginRequest,
            HttpServletRequest request,
            HttpServletResponse response) {
        request.setAttribute("audit.loginName", loginRequest.loginName());
        java.util.UUID loginBatch = java.util.UUID.randomUUID();
        request.setAttribute("audit.loginBatch", loginBatch);
        AdminPrincipal principal = authService.login(
                loginRequest.loginName(),
                loginRequest.password(),
                request.getRemoteAddr(),
                ApiTraceFilter.currentTraceId(request));

        HttpSession existingSession = request.getSession(false);
        if (existingSession != null) {
            request.changeSessionId();
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                principal,
                null,
                java.util.stream.Stream.concat(
                                java.util.stream.Stream.of(
                                        new SimpleGrantedAuthority("ROLE_" + principal.role().name())),
                                principal.role().permissions().stream().map(SimpleGrantedAuthority::new))
                        .toList()));
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        request.getSession().setAttribute("audit.loginBatch", loginBatch);
        return ApiResponse.of(AdminMeResponse.from(principal));
    }

    @GetMapping("/me")
    public ApiResponse<AdminMeResponse> me(
            @AuthenticationPrincipal AdminPrincipal principal) {
        return ApiResponse.of(AdminMeResponse.from(principal));
    }

    @PostMapping("/logout")
    public ApiResponse<String> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            request.setAttribute("audit.loginBatch", session.getAttribute("audit.loginBatch"));
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ApiResponse.of("logged-out");
    }
}
