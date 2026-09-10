package com.changqingjing.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.changqingjing.admin.api.scenic.AdminScenicQuery;
import com.changqingjing.admin.api.scenic.CreateMapSelectionRequest;
import com.changqingjing.admin.api.scenic.SaveScenicDraftRequest;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageQuery;
import com.changqingjing.media.MediaPurpose;
import java.math.BigDecimal;
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
class ScenicContentServiceIntegrationTest {

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
    private ScenicContentService scenicService;

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
    void publishesScenicAndKeepsCoordinatesWhenOnlyDisplayNameChanges() {
        AdminPrincipal actor = bootstrapAdmin();
        UUID coverId = insertReadyImage(actor.accountId());
        UUID bodyId = insertReadyImage(actor.accountId());
        var selection = scenicService.confirmMapSelection(
                new CreateMapSelectionRequest(
                        "无量寿禅寺",
                        "湖北省咸宁市通山县九宫山镇",
                        new BigDecimal("114.6500000"),
                        new BigDecimal("29.4200000")),
                actor);

        var draft = scenicService.create(
                draftRequest(
                        "九宫山景区",
                        coverId,
                        bodyId,
                        "常清净文旅·九宫山服务点",
                        selection.id(),
                        0),
                actor,
                "scenic-create");
        assertThat(draft.draft().location().providerName()).isEqualTo("无量寿禅寺");
        assertThat(draft.draft().location().displayName())
                .isEqualTo("常清净文旅·九宫山服务点");

        var published = scenicService.publish(
                draft.id(), draft.version(), actor, "scenic-publish");
        var publicScenic = scenicService.getPublished(draft.id());
        assertThat(publicScenic.revision().location().coordinateSystem()).isEqualTo("GCJ02");

        var renamed = scenicService.saveDraft(
                draft.id(),
                draftRequest(
                        "九宫山景区",
                        coverId,
                        bodyId,
                        "常清净文旅·九宫山度假区",
                        null,
                        published.version()),
                actor,
                "scenic-rename");
        assertThat(renamed.draft().location().longitude())
                .isEqualByComparingTo("114.6500000");
        assertThat(renamed.draft().location().providerName()).isEqualTo("无量寿禅寺");
        assertThat(scenicService.getPublished(draft.id()).revision().location().displayName())
                .isEqualTo("常清净文旅·九宫山服务点");
    }

    @Test
    void separatesOpenStatusFromPublicationAndDeduplicatesViews() {
        AdminPrincipal actor = bootstrapAdmin();
        UUID coverId = insertReadyImage(actor.accountId());
        UUID bodyId = insertReadyImage(actor.accountId());
        var selection = scenicService.confirmMapSelection(
                new CreateMapSelectionRequest(
                        "九宫山游客中心",
                        "湖北省咸宁市通山县九宫山",
                        new BigDecimal("114.6510000"),
                        new BigDecimal("29.4210000")),
                actor);
        var draft = scenicService.create(
                new SaveScenicDraftRequest(
                        "暂停开放的景区",
                        "景区正在维护",
                        coverId,
                        List.of(
                                new ScenicContentBlock(
                                        CompanyBlockType.PARAGRAPH,
                                        "维护期间仍可查看介绍",
                                        null,
                                        null),
                                new ScenicContentBlock(
                                        CompanyBlockType.IMAGE,
                                        null,
                                        bodyId,
                                        "景区图片")),
                        ScenicOpenStatus.PAUSED,
                        3,
                        "九宫山游客中心",
                        selection.id(),
                        0),
                actor,
                "paused-create");
        var published = scenicService.publish(
                draft.id(), draft.version(), actor, "paused-publish");

        AdminScenicQuery query = new AdminScenicQuery();
        query.setStatus(ScenicPublicationStatus.ONLINE);
        assertThat(scenicService.search(query).items().get(0).openStatus())
                .isEqualTo(ScenicOpenStatus.PAUSED);

        UUID viewId = UUID.randomUUID();
        assertThat(scenicService.recordView(draft.id(), viewId)).isEqualTo(1);
        assertThat(scenicService.recordView(draft.id(), viewId)).isEqualTo(1);
        assertThat(scenicService.recordView(draft.id(), UUID.randomUUID())).isEqualTo(2);

        PageQuery publicQuery = new PageQuery();
        assertThat(scenicService.getPublished(publicQuery).items()).hasSize(1);
        scenicService.unpublish(draft.id(), published.version(), actor, "paused-unpublish");
        assertThat(scenicService.getPublished(publicQuery).items()).isEmpty();
    }

    @Test
    void publishesScenicWithoutOptionalNavigationLocation() {
        AdminPrincipal actor = bootstrapAdmin();
        UUID coverId = insertReadyImage(actor.accountId());
        UUID bodyId = insertReadyImage(actor.accountId());
        var draft = scenicService.create(
                draftRequest(
                        "仙岛湖旅游风景区",
                        coverId,
                        bodyId,
                        "",
                        null,
                        0),
                actor,
                "scenic-without-location-create");

        var published = scenicService.publish(
                draft.id(), draft.version(), actor, "scenic-without-location-publish");

        assertThat(published.published().location()).isNull();
        assertThat(scenicService.getPublished(draft.id()).revision().location()).isNull();
    }

    @Test
    void rejectsPublishingIncompleteDraftAndDeletingOnlineScenic() {
        AdminPrincipal actor = bootstrapAdmin();
        var draft = scenicService.create(
                new SaveScenicDraftRequest(
                        "未完成景区",
                        "缺少封面和位置",
                        null,
                        List.of(),
                        ScenicOpenStatus.OPEN,
                        0,
                        "",
                        null,
                        0),
                actor,
                "incomplete-create");
        assertThatThrownBy(() -> scenicService.publish(
                draft.id(), draft.version(), actor, "incomplete-publish"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("SCENIC_COVER_REQUIRED");
    }

    private SaveScenicDraftRequest draftRequest(
            String title,
            UUID coverId,
            UUID bodyId,
            String displayName,
            UUID selectionId,
            long version) {
        return new SaveScenicDraftRequest(
                title,
                "山水与文化景区简介",
                coverId,
                List.of(
                        new ScenicContentBlock(
                                CompanyBlockType.HEADING,
                                "景区介绍",
                                null,
                                null),
                        new ScenicContentBlock(
                                CompanyBlockType.PARAGRAPH,
                                "这里是景区详细介绍",
                                null,
                                null),
                        new ScenicContentBlock(
                                CompanyBlockType.IMAGE,
                                null,
                                bodyId,
                                "景区风光")),
                ScenicOpenStatus.OPEN,
                1,
                displayName,
                selectionId,
                version);
    }

    private UUID insertReadyImage(UUID actorId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO media_asset (
                    id, object_key, original_filename, media_type, content_type,
                    size_bytes, etag, status, purpose, uploaded_by, created_at,
                    updated_at, verified_at, upload_expires_at
                ) VALUES (?, ?, ?, 'IMAGE', 'image/png', 8, 'etag', 'READY', ?, ?,
                          now(), now(), now(), now() + interval '15 minutes')
                """,
                id,
                "test/" + id,
                id + ".png",
                MediaPurpose.SCENIC_IMAGE.name(),
                actorId);
        return id;
    }

    private AdminPrincipal bootstrapAdmin() {
        UUID id = bootstrapService.createFirstAdmin(
                "scenic.admin", "景区管理员", "ScenicAdmin2026", "bootstrap");
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
