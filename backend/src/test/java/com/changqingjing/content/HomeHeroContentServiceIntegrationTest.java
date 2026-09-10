package com.changqingjing.content;

import static org.assertj.core.api.Assertions.assertThat;

import com.changqingjing.admin.api.content.SaveHomeHeroDraftRequest;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaType;
import java.time.Instant;
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
class HomeHeroContentServiceIntegrationTest {

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
    private HomeHeroContentService contentService;

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
    void keepsDraftSeparateFromPublishedHeroAndStoresItsFocalPoint() {
        AdminPrincipal actor = bootstrapAdmin();
        UUID imageId = insertReadyHero(actor.accountId());

        var draft = contentService.saveDraft(
                new SaveHomeHeroDraftRequest(
                        "循文化之脉", "见山水之美", imageId, 38, 64, 0),
                actor,
                "hero-draft");
        assertThat(draft.version()).isEqualTo(1);
        assertThat(contentService.getPublished()).isEmpty();
        assertThat(draft.draft().focusX()).isEqualTo(38);
        assertThat(draft.draft().focusY()).isEqualTo(64);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM content_revision_media WHERE revision_id = ?",
                Long.class,
                draft.draft().id())).isEqualTo(1);

        var published = contentService.publish(
                draft.version(), actor, "hero-publish");
        var publicHero = contentService.getPublished().orElseThrow().revision();
        assertThat(published.visibility()).isEqualTo("PUBLISHED");
        assertThat(publicHero.coverMediaId()).isEqualTo(imageId);
        assertThat(publicHero.title()).isEqualTo("循文化之脉");

        var unpublished = contentService.unpublish(
                published.version(), actor, "hero-unpublish");
        assertThat(unpublished.visibility()).isEqualTo("HIDDEN");
        assertThat(contentService.getPublished()).isEmpty();
    }

    private UUID insertReadyHero(UUID actorId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO media_asset (
                    id, object_key, original_filename, media_type, content_type,
                    size_bytes, etag, status, purpose, uploaded_by, created_at,
                    updated_at, verified_at, upload_expires_at
                ) VALUES (?, ?, ?, ?, ?, 8, 'etag', 'READY', ?, ?, now(), now(), now(),
                          now() + interval '15 minutes')
                """,
                id,
                "test/" + id,
                id + ".png",
                MediaType.IMAGE.name(),
                "image/png",
                MediaPurpose.HOME_HERO.name(),
                actorId);
        return id;
    }

    private AdminPrincipal bootstrapAdmin() {
        UUID id = bootstrapService.createFirstAdmin(
                "hero.admin", "头图管理员", "HeroAdmin2026", "bootstrap");
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
