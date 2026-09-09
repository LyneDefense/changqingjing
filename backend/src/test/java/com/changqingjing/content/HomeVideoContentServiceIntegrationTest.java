package com.changqingjing.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.changqingjing.admin.api.content.SaveHomeVideoDraftRequest;
import com.changqingjing.admin.api.content.AdminHomeVideoQuery;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
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
class HomeVideoContentServiceIntegrationTest {

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
    private HomeVideoContentService contentService;

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
    void publishesOnlyReadyVideoAndKeepsPublishedVersionOnReplacementFailure() {
        AdminPrincipal actor = bootstrapAdmin();
        UUID videoId = insertMedia(actor.accountId(), MediaPurpose.HOME_VIDEO, "READY");
        UUID coverId = insertMedia(actor.accountId(), MediaPurpose.HOME_VIDEO_COVER, "READY");

        var draft = contentService.create(
                new SaveHomeVideoDraftRequest(
                        "山水宣传片", videoId, coverId, 0),
                actor,
                "video-draft");
        assertThat(contentService.getPublished()).isEmpty();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM content_revision_media WHERE revision_id = ?",
                Long.class,
                draft.draft().id())).isEqualTo(2);

        var published = contentService.publish(
                draft.id(), draft.version(), actor, "video-publish");
        assertThat(contentService.getPublished().orElseThrow().revision().videoMediaId())
                .isEqualTo(videoId);

        UUID failedReplacement = insertMedia(
                actor.accountId(), MediaPurpose.HOME_VIDEO, "FAILED");
        assertThatThrownBy(() -> contentService.saveDraft(
                published.id(),
                new SaveHomeVideoDraftRequest(
                        "失败替换", failedReplacement, coverId, published.version()),
                actor,
                "video-replacement"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("MEDIA_NOT_READY");
        assertThat(contentService.getPublished().orElseThrow().revision().videoMediaId())
                .isEqualTo(videoId);
    }

    @Test
    void listsFiltersReplacesAndDeletesHomeVideos() {
        AdminPrincipal actor = bootstrapAdmin();
        UUID firstVideoId = insertMedia(actor.accountId(), MediaPurpose.HOME_VIDEO, "READY");
        UUID firstCoverId = insertMedia(actor.accountId(), MediaPurpose.HOME_VIDEO_COVER, "READY");
        var first = contentService.create(
                new SaveHomeVideoDraftRequest(
                        "第一条山水宣传片", firstVideoId, firstCoverId, 0),
                actor,
                "first-create");
        first = contentService.publish(first.id(), first.version(), actor, "first-publish");

        UUID secondVideoId = insertMedia(actor.accountId(), MediaPurpose.HOME_VIDEO, "READY");
        UUID secondCoverId = insertMedia(actor.accountId(), MediaPurpose.HOME_VIDEO_COVER, "READY");
        var second = contentService.create(
                new SaveHomeVideoDraftRequest(
                        "第二条文化宣传片", secondVideoId, secondCoverId, 0),
                actor,
                "second-create");
        second = contentService.publish(second.id(), second.version(), actor, "second-publish");

        assertThat(contentService.getPublished().orElseThrow().revision().videoMediaId())
                .isEqualTo(secondVideoId);
        assertThat(contentService.getAdminContent(first.id()).visibility())
                .isEqualTo("HIDDEN");

        AdminHomeVideoQuery onlineQuery = new AdminHomeVideoQuery();
        onlineQuery.setStatus(HomeVideoStatus.ONLINE);
        var online = contentService.search(onlineQuery);
        assertThat(online.total()).isEqualTo(1);
        assertThat(online.items().get(0).title()).isEqualTo("第二条文化宣传片");

        AdminHomeVideoQuery keywordQuery = new AdminHomeVideoQuery();
        keywordQuery.setKeyword("山水");
        assertThat(contentService.search(keywordQuery).items())
                .extracting(item -> item.title())
                .containsExactly("第一条山水宣传片");

        var publishedSecond = second;
        assertThatThrownBy(() -> contentService.delete(
                publishedSecond.id(),
                publishedSecond.version(),
                actor,
                "delete-online"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("HOME_VIDEO_ONLINE");

        var offline = contentService.unpublish(
                second.id(), second.version(), actor, "second-unpublish");
        contentService.delete(
                offline.id(), offline.version(), actor, "second-delete");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM content_entry WHERE id = ?",
                Long.class,
                second.id())).isZero();
        assertThat(contentService.getPublished()).isEmpty();
    }

    private UUID insertMedia(UUID actorId, MediaPurpose purpose, String status) {
        UUID id = UUID.randomUUID();
        MediaType type = purpose.mediaType();
        boolean ready = "READY".equals(status);
        jdbcTemplate.update("""
                INSERT INTO media_asset (
                    id, object_key, original_filename, media_type, content_type,
                    size_bytes, etag, status, purpose, uploaded_by, created_at,
                    updated_at, verified_at, upload_expires_at
                ) VALUES (?, ?, ?, ?, ?, 8, ?, ?, ?, ?, now(), now(), ?,
                          now() + interval '15 minutes')
                """,
                id,
                "test/" + id,
                id + (type == MediaType.IMAGE ? ".png" : ".mp4"),
                type.name(),
                type == MediaType.IMAGE ? "image/png" : "video/mp4",
                ready ? "etag" : null,
                status,
                purpose.name(),
                actorId,
                ready ? java.time.OffsetDateTime.now() : null);
        return id;
    }

    private AdminPrincipal bootstrapAdmin() {
        UUID id = bootstrapService.createFirstAdmin(
                "video.admin", "视频管理员", "VideoAdmin2026", "bootstrap");
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
