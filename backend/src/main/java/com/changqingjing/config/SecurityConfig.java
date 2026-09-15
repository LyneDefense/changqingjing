package com.changqingjing.config;

import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminSessionValidationFilter;
import com.changqingjing.app.auth.AppBearerAuthenticationFilter;
import com.changqingjing.app.auth.AppTokenAuthenticator;
import com.changqingjing.common.web.JsonAccessDeniedHandler;
import com.changqingjing.common.web.JsonAuthenticationEntryPoint;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.security.web.header.writers.StaticHeadersWriter;

@Configuration
public class SecurityConfig {

    @Bean
    @Order(1)
    SecurityFilterChain adminSecurityFilterChain(
            HttpSecurity http,
            AdminAccountRepository adminAccountRepository,
            @Value("${app.admin.session.absolute-lifetime:12h}") Duration absoluteLifetime,
            AuthenticationEntryPoint jsonAuthenticationEntryPoint,
            AccessDeniedHandler jsonAccessDeniedHandler) throws Exception {
        return http
            .securityMatcher("/api/v1/admin/**")
            .requestCache(cache -> cache.disable())
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(jsonAuthenticationEntryPoint)
                .accessDeniedHandler(jsonAccessDeniedHandler))
            .headers(headers -> addApiSecurityHeaders(headers))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(HttpMethod.GET,
                    "/api/v1/admin/system/ping",
                    "/api/v1/admin/auth/csrf").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/admin/auth/login").permitAll()
                .requestMatchers("/api/v1/admin/auth/me", "/api/v1/admin/auth/logout").authenticated()
                .requestMatchers("/api/v1/admin/staff/**", "/api/v1/admin/users/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/v1/admin/audit-events/**").hasAnyRole("ADMIN", "OPERATOR")
                .requestMatchers(
                    "/api/v1/admin/contents/**",
                    "/api/v1/admin/media/**",
                    "/api/v1/admin/map-selections/**",
                    "/api/v1/admin/scenics/**",
                    "/api/v1/admin/product-categories/**",
                    "/api/v1/admin/products/**").hasAnyRole("ADMIN", "OPERATOR")
                .anyRequest().denyAll())
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .logout(logout -> logout.disable())
            .addFilterBefore(
                new AdminSessionValidationFilter(
                    adminAccountRepository,
                    jsonAuthenticationEntryPoint,
                    absoluteLifetime),
                AnonymousAuthenticationFilter.class)
            .build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain appSecurityFilterChain(
            HttpSecurity http,
            AppTokenAuthenticator tokenAuthenticator,
            AuthenticationEntryPoint jsonAuthenticationEntryPoint,
            AccessDeniedHandler jsonAccessDeniedHandler) throws Exception {
        return http
            .securityMatcher("/api/v1/app/**", "/actuator/health/**")
            .csrf(csrf -> csrf.disable())
            .requestCache(cache -> cache.disable())
            .securityContext(context -> context
                .securityContextRepository(new NullSecurityContextRepository()))
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(jsonAuthenticationEntryPoint)
                .accessDeniedHandler(jsonAccessDeniedHandler))
            .headers(headers -> addApiSecurityHeaders(headers))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.GET,
                    "/api/v1/app/system/ping",
                    "/api/v1/app/home",
                    "/api/v1/app/company",
                    "/api/v1/app/cooperation",
                    "/api/v1/app/scenics/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/app/scenics/*/views").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/app/auth/logout").hasRole("APP_USER")
                .requestMatchers("/api/v1/app/auth/**").permitAll()
                .requestMatchers(
                    "/api/v1/app/me",
                    "/api/v1/app/me/**",
                    "/api/v1/app/product-categories/**",
                    "/api/v1/app/products/**").hasRole("APP_USER")
                .anyRequest().denyAll())
            .addFilterBefore(
                new AppBearerAuthenticationFilter(tokenAuthenticator, jsonAuthenticationEntryPoint),
                AnonymousAuthenticationFilter.class)
            .build();
    }

    @Bean
    @Order(4)
    SecurityFilterChain fallbackSecurityFilterChain(
            HttpSecurity http,
            AuthenticationEntryPoint jsonAuthenticationEntryPoint,
            AccessDeniedHandler jsonAccessDeniedHandler) throws Exception {
        return http
            .requestCache(cache -> cache.disable())
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(jsonAuthenticationEntryPoint)
                .accessDeniedHandler(jsonAccessDeniedHandler))
            .headers(headers -> addApiSecurityHeaders(headers))
            .authorizeHttpRequests(authorize -> authorize.anyRequest().denyAll())
            .build();
    }

    @Bean
    AuthenticationEntryPoint jsonAuthenticationEntryPoint(ObjectMapper objectMapper) {
        return new JsonAuthenticationEntryPoint(objectMapper);
    }

    @Bean
    AccessDeniedHandler jsonAccessDeniedHandler(ObjectMapper objectMapper) {
        return new JsonAccessDeniedHandler(objectMapper);
    }

    @Bean
    @ConditionalOnMissingBean(AppTokenAuthenticator.class)
    AppTokenAuthenticator rejectingAppTokenAuthenticator() {
        return rawToken -> Optional.empty();
    }

    @Bean
    PasswordEncoder adminPasswordEncoder(
            @Value("${app.admin.password.bcrypt-strength:12}") int bcryptStrength) {
        return new BCryptPasswordEncoder(bcryptStrength);
    }

    private void addApiSecurityHeaders(
            org.springframework.security.config.annotation.web.configurers.HeadersConfigurer<HttpSecurity> headers) {
        headers
            .addHeaderWriter(new StaticHeadersWriter(
                "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"))
            .addHeaderWriter(new StaticHeadersWriter("Referrer-Policy", "no-referrer"))
            .addHeaderWriter(new StaticHeadersWriter(
                "Permissions-Policy", "camera=(), geolocation=(), microphone=()"));
    }
}
