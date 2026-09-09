package com.changqingjing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@Profile("openapi")
public class OpenApiSecurityConfig {

    @Bean
    @Order(3)
    SecurityFilterChain openApiSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/internal/openapi/**")
            .csrf(csrf -> csrf.disable())
            .requestCache(cache -> cache.disable())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
            .build();
    }
}
