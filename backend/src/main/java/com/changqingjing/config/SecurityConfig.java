package com.changqingjing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    @Order(1)
    SecurityFilterChain adminSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/api/v1/admin/**")
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/api/v1/admin/system/ping").permitAll()
                .anyRequest().authenticated())
            .httpBasic(Customizer.withDefaults())
            .build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain appSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/api/v1/app/**", "/actuator/health/**")
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/v1/app/**"))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/api/v1/app/system/ping", "/actuator/health/**").permitAll()
                .anyRequest().authenticated())
            .build();
    }

    @Bean
    @Order(3)
    SecurityFilterChain fallbackSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(authorize -> authorize.anyRequest().denyAll())
            .build();
    }
}
