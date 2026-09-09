package com.changqingjing.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.changqingjing.admin.api.cooperation.SaveCooperationDraftRequest;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "app.admin.password.bcrypt-strength=4")
@Testcontainers
class CooperationContentServiceIntegrationTest {

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
    private CooperationContentService contentService;

    @Autowired
    private AdminBootstrapService bootstrapService;

    @Autowired
    private AdminAccountRepository accountRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_account CASCADE");
    }

    @Test
    void publishesOrderedSectionsAndKeepsDraftSeparate() {
        AdminPrincipal actor = bootstrapAdmin();
        var draft = contentService.saveDraft(request("Value A", 0), actor, "create");
        var published = contentService.publish(draft.version(), actor, "publish");

        assertThat(contentService.getPublished().valueSections().get(0).title())
                .isEqualTo("Value A");

        contentService.saveDraft(request("Value B", published.version()), actor, "update");
        assertThat(contentService.getPublished().valueSections().get(0).title())
                .isEqualTo("Value A");
    }

    @Test
    void rejectsPublishingIncompleteContent() {
        AdminPrincipal actor = bootstrapAdmin();
        var draft = contentService.saveDraft(
                new SaveCooperationDraftRequest(
                        "Cooperation", "Overview", List.of(), List.of(), 0),
                actor,
                "incomplete");

        assertThatThrownBy(() -> contentService.publish(
                draft.version(), actor, "publish-incomplete"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("COOPERATION_REVENUE_REQUIRED");
    }

    private SaveCooperationDraftRequest request(String valueTitle, long version) {
        return new SaveCooperationDraftRequest(
                "Cooperation",
                "Cooperation overview",
                List.of(
                        new CooperationRevenueSection("Recruiting", "Partner fees", "R", 2),
                        new CooperationRevenueSection("Supply", "Product revenue", "S", 1)),
                List.of(new CooperationValueSection(
                        valueTitle, "Long-term value", null, null, 1)),
                version);
    }
    private AdminPrincipal bootstrapAdmin() {
        UUID id = bootstrapService.createFirstAdmin(
                "cooperation.admin", "Cooperation Admin", "Cooperation2026", "bootstrap");
        AdminAccount account = accountRepository.findById(id).orElseThrow();
        return new AdminPrincipal(
                id,
                account.loginNameNormalized(),
                account.displayName(),
                account.role(),
                account.lockVersion(),
                Instant.now());
    }
}
