package com.changqingjing.config;

import com.changqingjing.admin.audit.AdminAuditFilter;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.audit.AdminAuditSnapshot;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AdminAuditConfig {
    @Bean
    FilterRegistrationBean<AdminAuditFilter> adminAuditFilter(AdminAuditService audit, AdminAuditSnapshot snapshots) {
        var registration = new FilterRegistrationBean<>(new AdminAuditFilter(audit, snapshots));
        registration.addUrlPatterns("/api/v1/admin/*");
        // Spring Session has already wrapped the request; capture security and MVC outcomes.
        registration.setOrder(-101);
        return registration;
    }
}
