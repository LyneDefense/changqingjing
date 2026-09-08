package com.changqingjing.app.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.web.filter.OncePerRequestFilter;

public class AppBearerAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final AppTokenAuthenticator tokenAuthenticator;
    private final AuthenticationEntryPoint authenticationEntryPoint;

    public AppBearerAuthenticationFilter(
            AppTokenAuthenticator tokenAuthenticator,
            AuthenticationEntryPoint authenticationEntryPoint) {
        this.tokenAuthenticator = tokenAuthenticator;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!authorization.startsWith(BEARER_PREFIX)) {
            authenticationEntryPoint.commence(
                    request,
                    response,
                    new BadCredentialsException("Unsupported authorization scheme"));
            return;
        }

        String rawToken = authorization.substring(BEARER_PREFIX.length()).trim();
        Optional<AppPrincipal> principal = rawToken.isEmpty()
                ? Optional.empty()
                : tokenAuthenticator.authenticate(rawToken);
        if (principal.isEmpty()) {
            authenticationEntryPoint.commence(
                    request,
                    response,
                    new BadCredentialsException("Invalid app session"));
            return;
        }

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new AppAuthenticationToken(principal.get()));
        SecurityContextHolder.setContext(context);
        filterChain.doFilter(request, response);
    }
}
