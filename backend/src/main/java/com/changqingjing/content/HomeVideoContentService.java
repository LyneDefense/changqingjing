package com.changqingjing.content;

import com.changqingjing.admin.api.content.AdminHomeVideoContentResponse;
import com.changqingjing.admin.api.content.AdminHomeVideoRevisionResponse;
import com.changqingjing.admin.api.content.SaveHomeVideoDraftRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.media.MediaAssetRepository;
import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HomeVideoContentService {

    private final HomeVideoContentRepository repository;
    private final MediaService mediaService;
    private final AdminAuditService auditService;
    private final Clock clock = Clock.systemUTC();

    public HomeVideoContentService(
            HomeVideoContentRepository repository,
            MediaService mediaService,
            AdminAuditService auditService) {
        this.repository = repository;
        this.mediaService = mediaService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public AdminHomeVideoContentResponse getAdminContent() {
        return repository.findEntry(false)
                .map(this::toAdminResponse)
                .orElseGet(AdminHomeVideoContentResponse::empty);
    }

    @Transactional(readOnly = true)
    public AdminHomeVideoRevisionResponse getDraftPreview() {
        HomeVideoContentRepository.Entry entry = requiredEntry(false);
        return repository.findRevision(entry.draftRevisionId())
                .map(AdminHomeVideoRevisionResponse::from)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "CONTENT_DRAFT_NOT_FOUND",
                        "尚未保存宣传视频草稿"));
    }

    @Transactional
    public AdminHomeVideoContentResponse saveDraft(
            SaveHomeVideoDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        repository.lockSingletonCreation();
        HomeVideoContentRepository.Entry entry = repository.findEntry(true)
                .orElseGet(() -> repository.insertEntry(
                        UUID.randomUUID(), actor.accountId(), now()));
        verifyVersion(entry, request.expectedVersion());
        requirePurpose(request.videoMediaId(), MediaPurpose.HOME_VIDEO);
        requirePurpose(request.coverMediaId(), MediaPurpose.HOME_VIDEO_COVER);

        OffsetDateTime now = now();
        int revisionNumber = repository.nextRevisionNumber(entry.id());
        HomeVideoContentRepository.Revision revision = repository.insertRevision(
                UUID.randomUUID(),
                entry.id(),
                revisionNumber,
                request.title().strip(),
                request.coverMediaId(),
                request.videoMediaId(),
                request.displayEnabled(),
                actor.accountId(),
                now);
        if (!repository.pointDraft(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "HOME_VIDEO_DRAFT_SAVE",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of("revisionNumber", revisionNumber));
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional
    public AdminHomeVideoContentResponse publish(
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        HomeVideoContentRepository.Entry entry = requiredEntry(true);
        verifyVersion(entry, expectedVersion);
        HomeVideoContentRepository.Revision revision = repository
                .findRevision(entry.draftRevisionId())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.CONFLICT,
                        "CONTENT_DRAFT_REQUIRED",
                        "请先保存宣传视频草稿"));
        requirePurpose(revision.videoMediaId(), MediaPurpose.HOME_VIDEO);
        requirePurpose(revision.coverMediaId(), MediaPurpose.HOME_VIDEO_COVER);
        OffsetDateTime now = now();
        if (!repository.publish(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "HOME_VIDEO_PUBLISH",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of("revisionId", revision.id()));
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional
    public AdminHomeVideoContentResponse unpublish(
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        HomeVideoContentRepository.Entry entry = requiredEntry(true);
        verifyVersion(entry, expectedVersion);
        OffsetDateTime now = now();
        if (!repository.unpublish(
                entry.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "HOME_VIDEO_UNPUBLISH",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of());
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional(readOnly = true)
    public Optional<PublishedHomeVideo> getPublished() {
        return repository.findEntry(false)
                .filter(entry -> "PUBLISHED".equals(entry.visibility()))
                .flatMap(entry -> repository.findRevision(entry.publishedRevisionId()))
                .filter(HomeVideoContentRepository.Revision::displayEnabled)
                .map(PublishedHomeVideo::new);
    }

    private void requirePurpose(UUID mediaId, MediaPurpose expectedPurpose) {
        MediaAssetRepository.Asset asset = mediaService.requireReady(mediaId);
        if (asset.purpose() != expectedPurpose) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "MEDIA_PURPOSE_MISMATCH",
                    "所选媒体不能用于当前内容位置");
        }
    }

    private HomeVideoContentRepository.Entry requiredEntry(boolean forUpdate) {
        return repository.findEntry(forUpdate).orElseThrow(() -> new BusinessException(
                HttpStatus.NOT_FOUND,
                "CONTENT_NOT_FOUND",
                "宣传视频尚未创建"));
    }

    private void verifyVersion(HomeVideoContentRepository.Entry entry, long expectedVersion) {
        if (entry.version() != expectedVersion) {
            throw versionConflict();
        }
    }

    private BusinessException versionConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "CONTENT_VERSION_CONFLICT",
                "内容已被其他人员修改，请刷新后重试");
    }

    private AdminHomeVideoContentResponse toAdminResponse(
            HomeVideoContentRepository.Entry entry) {
        AdminHomeVideoRevisionResponse draft = repository
                .findRevision(entry.draftRevisionId())
                .map(AdminHomeVideoRevisionResponse::from)
                .orElse(null);
        AdminHomeVideoRevisionResponse published = repository
                .findRevision(entry.publishedRevisionId())
                .map(AdminHomeVideoRevisionResponse::from)
                .orElse(null);
        return new AdminHomeVideoContentResponse(
                entry.id(),
                entry.version(),
                entry.visibility(),
                entry.firstPublishedAt(),
                entry.updatedAt(),
                draft,
                published);
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    public record PublishedHomeVideo(HomeVideoContentRepository.Revision revision) {
    }
}
