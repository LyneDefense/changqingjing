package com.changqingjing.admin.auth;

import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.admin.bootstrap.enabled", havingValue = "true")
public class AdminBootstrapRunner implements ApplicationRunner {

    private final AdminBootstrapService bootstrapService;
    private final String loginName;
    private final String displayName;
    private final String password;

    public AdminBootstrapRunner(
            AdminBootstrapService bootstrapService,
            @Value("${app.admin.bootstrap.login-name:}") String loginName,
            @Value("${app.admin.bootstrap.display-name:}") String displayName,
            @Value("${app.admin.bootstrap.password:}") String password) {
        this.bootstrapService = bootstrapService;
        this.loginName = loginName;
        this.displayName = displayName;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        bootstrapService.createFirstAdmin(
                loginName,
                displayName,
                password,
                "bootstrap-" + UUID.randomUUID());
    }
}
