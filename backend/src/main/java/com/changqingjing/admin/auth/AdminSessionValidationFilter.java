package com.changqingjing.admin.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.web.filter.OncePerRequestFilter;

public class AdminSessionValidationFilter extends OncePerRequestFilter {

    private final AdminAccountRepository accountRepository;
    private final AuthenticationEntryPoint authenticationEntryPoint;
    private final Duration absoluteLifetime;
    private final Clock clock;

    public AdminSessionValidationFilter(
            AdminAccountRepository accountRepository,
            AuthenticationEntryPoint authenticationEntryPoint,
            @Value("${app.admin.session.absolute-lifetime:12h}") Duration absoluteLifetime) {
        this(accountRepository, authenticationEntryPoint, absoluteLifetime, Clock.systemUTC());
    }

    AdminSessionValidationFilter(
            AdminAccountRepository accountRepository,
            AuthenticationEntryPoint authenticationEntryPoint,
            Duration absoluteLifetime,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.absoluteLifetime = absoluteLifetime;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof AdminPrincipal principal
                && !isCurrent(principal)) {
            SecurityContextHolder.clearContext();
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            authenticationEntryPoint.commence(request, response, null);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isCurrent(AdminPrincipal principal) {
        if (principal.authenticatedAt().plus(absoluteLifetime).isBefore(clock.instant())) {
            return false;
        }
        return accountRepository.findById(principal.accountId())
                .filter(account -> account.status() == AdminStatus.ACTIVE)
                .filter(account -> account.lockVersion() == principal.accountVersion())
                .filter(account -> account.loginNameNormalized().equals(principal.loginName()))
                .isPresent();
    }
}
