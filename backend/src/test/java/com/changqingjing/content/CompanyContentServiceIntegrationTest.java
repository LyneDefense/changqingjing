package com.changqingjing.content;

import static org.assertj.core.api.Assertions.assertThat;

import com.changqingjing.admin.api.content.SaveCompanyDraftRequest;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaType;
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
class CompanyContentServiceIntegrationTest {

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
    private CompanyContentService contentService;

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
    void keepsDraftSeparateFromPublishedContentAndUnpublishesOldLinks() {
        AdminPrincipal actor = bootstrapAdmin();
        assertThat(contentService.getAdminContent().id()).isNull();
        assertThat(contentService.getPublished()).isEmpty();

        var firstDraft = contentService.saveDraft(
                draft("第一版公司介绍", "第一版简介", 0),
                actor,
                "company-draft-one");
        assertThat(firstDraft.version()).isEqualTo(1);
        assertThat(firstDraft.published()).isNull();
        assertThat(contentService.getPublished()).isEmpty();

        var firstPublish = contentService.publish(
                firstDraft.version(), actor, "company-publish-one");
        assertThat(firstPublish.version()).isEqualTo(2);
        assertThat(firstPublish.visibility()).isEqualTo("PUBLISHED");
        assertThat(contentService.getPublished().orElseThrow().revision().title())
                .isEqualTo("第一版公司介绍");

        var secondDraft = contentService.saveDraft(
                draft("第二版公司介绍", "第二版简介", firstPublish.version()),
                actor,
                "company-draft-two");
        assertThat(secondDraft.draft().title()).isEqualTo("第二版公司介绍");
        assertThat(secondDraft.published().title()).isEqualTo("第一版公司介绍");
        assertThat(contentService.getPublished().orElseThrow().revision().title())
                .isEqualTo("第一版公司介绍");

        var secondPublish = contentService.publish(
                secondDraft.version(), actor, "company-publish-two");
        assertThat(secondPublish.firstPublishedAt()).isEqualTo(firstPublish.firstPublishedAt());
        assertThat(contentService.getPublished().orElseThrow().revision().title())
                .isEqualTo("第二版公司介绍");

        var unpublished = contentService.unpublish(
                secondPublish.version(), actor, "company-unpublish");
        assertThat(unpublished.visibility()).isEqualTo("HIDDEN");
        assertThat(unpublished.published().title()).isEqualTo("第二版公司介绍");
        assertThat(contentService.getPublished()).isEmpty();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM content_revision",
                Long.class)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM admin_audit_event WHERE target_type = 'CONTENT_ENTRY'",
                Long.class)).isEqualTo(5);
    }

    @Test
    void rejectsOneOfTwoConcurrentDraftsBasedOnTheSameVersion() throws Exception {
        AdminPrincipal actor = bootstrapAdmin();
        var initial = contentService.saveDraft(
                draft("初始版本", "简介", 0), actor, "company-initial");
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<String>> results = List.of(
                    executor.submit(() -> saveAfter(
                            start, actor, "并发版本 A", initial.version())),
                    executor.submit(() -> saveAfter(
                            start, actor, "并发版本 B", initial.version())));
            start.countDown();

            assertThat(List.of(results.get(0).get(), results.get(1).get()))
                    .containsExactlyInAnyOrder("SAVED", "CONTENT_VERSION_CONFLICT");
        } finally {
            executor.shutdownNow();
        }
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM content_revision",
                Long.class)).isEqualTo(2);
    }

    @Test
    void recordsCoverAndBodyImageReferencesForEveryImmutableRevision() {
        AdminPrincipal actor = bootstrapAdmin();
        UUID coverId = insertReadyMedia(
                actor.accountId(), MediaPurpose.COMPANY_COVER, MediaType.IMAGE);
        UUID imageId = insertReadyMedia(
                actor.accountId(), MediaPurpose.COMPANY_IMAGE, MediaType.IMAGE);

        var saved = contentService.saveDraft(
                new SaveCompanyDraftRequest(
                        "带图片的公司介绍",
                        "首页简介",
                        coverId,
                        List.of(
                                new CompanyContentBlock(
                                        CompanyBlockType.IMAGE,
                                        null,
                                        imageId,
                                        "山水图片"),
                                new CompanyContentBlock(
                                        CompanyBlockType.PARAGRAPH,
                                        "正文")),
                        0),
                actor,
                "company-media");

        assertThat(saved.draft().coverMediaId()).isEqualTo(coverId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM content_revision_media WHERE revision_id = ?",
                Long.class,
                saved.draft().id())).isEqualTo(2);
        contentService.publish(saved.version(), actor, "company-media-publish");
        assertThat(contentService.getPublished().orElseThrow().revision().blocks())
                .extracting(CompanyContentBlock::mediaId)
                .contains(imageId);
    }

    private String saveAfter(
            CountDownLatch start,
            AdminPrincipal actor,
            String title,
            long version) throws InterruptedException {
        start.await();
        try {
            contentService.saveDraft(
                    draft(title, "并发简介", version), actor, "company-concurrent");
            return "SAVED";
        } catch (BusinessException exception) {
            return exception.getCode();
        }
    }

    private SaveCompanyDraftRequest draft(
            String title,
            String summary,
            long expectedVersion) {
        return new SaveCompanyDraftRequest(
                title,
                summary,
                List.of(
                        new CompanyContentBlock(CompanyBlockType.HEADING, "我们的使命"),
                        new CompanyContentBlock(CompanyBlockType.PARAGRAPH, "连接文化与旅行。")),
                expectedVersion);
    }

    private AdminPrincipal bootstrapAdmin() {
        UUID id = bootstrapService.createFirstAdmin(
                "content.admin", "内容管理员", "ContentAdmin2026", "bootstrap");
        AdminAccount account = accountRepository.findById(id).orElseThrow();
        return new AdminPrincipal(
                id,
                account.loginNameNormalized(),
                account.displayName(),
                account.role(),
                account.lockVersion(),
                Instant.now());
    }

    private UUID insertReadyMedia(
            UUID actorId,
            MediaPurpose purpose,
            MediaType mediaType) {
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
                mediaType.name(),
                mediaType == MediaType.IMAGE ? "image/png" : "video/mp4",
                purpose.name(),
                actorId);
        return id;
    }
}
