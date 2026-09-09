package com.changqingjing.content;

import com.changqingjing.admin.api.content.AdminHomeVideoContentResponse;
import com.changqingjing.admin.api.content.AdminHomeVideoListItemResponse;
import com.changqingjing.admin.api.content.AdminHomeVideoQuery;
import com.changqingjing.admin.api.content.AdminHomeVideoRevisionResponse;
import com.changqingjing.admin.api.content.SaveHomeVideoDraftRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageResponse;
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
    public PageResponse<AdminHomeVideoListItemResponse> search(AdminHomeVideoQuery query) {
        var entries = repository.search(query.getKeyword(), query.getStatus(), query);
        var items = entries.stream().map(this::toListItem).toList();
        return PageResponse.of(
                items,
                query,
                repository.count(query.getKeyword(), query.getStatus()));
    }

    @Transactional(readOnly = true)
    public AdminHomeVideoContentResponse getAdminContent(UUID entryId) {
        return toAdminResponse(requiredEntry(entryId, false));
    }

    @Transactional(readOnly = true)
    public AdminHomeVideoRevisionResponse getDraftPreview(UUID entryId) {
        HomeVideoContentRepository.Entry entry = requiredEntry(entryId, false);
        return repository.findRevision(entry.draftRevisionId())
                .map(AdminHomeVideoRevisionResponse::from)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "CONTENT_DRAFT_NOT_FOUND",
                        "这条宣传视频还没有保存草稿"));
    }

    @Transactional
    public AdminHomeVideoContentResponse create(
            SaveHomeVideoDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        if (request.expectedVersion() != 0) throw versionConflict();
        repository.lockVideoSet();
        OffsetDateTime now = now();
        HomeVideoContentRepository.Entry entry = repository.insertEntry(
                UUID.randomUUID(), actor.accountId(), now);
        return saveRevision(entry, request, actor, traceId, now);
    }

    @Transactional
    public AdminHomeVideoContentResponse saveDraft(
            UUID entryId,
            SaveHomeVideoDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        HomeVideoContentRepository.Entry entry = requiredEntry(entryId, true);
        verifyVersion(entry, request.expectedVersion());
        return saveRevision(entry, request, actor, traceId, now());
    }

    @Transactional
    public AdminHomeVideoContentResponse publish(
            UUID entryId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        repository.lockVideoSet();
        HomeVideoContentRepository.Entry entry = requiredEntry(entryId, true);
        verifyVersion(entry, expectedVersion);
        HomeVideoContentRepository.Revision revision = repository
                .findRevision(entry.draftRevisionId())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.CONFLICT,
                        "CONTENT_DRAFT_REQUIRED",
                        "请先保存这条宣传视频"));
        requirePurpose(revision.videoMediaId(), MediaPurpose.HOME_VIDEO);
        requirePurpose(revision.coverMediaId(), MediaPurpose.HOME_VIDEO_COVER);
        OffsetDateTime now = now();
        repository.unpublishOtherEntries(entry.id(), actor.accountId(), now);
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
        return toAdminResponse(requiredEntry(entry.id(), false));
    }

    @Transactional
    public AdminHomeVideoContentResponse unpublish(
            UUID entryId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        HomeVideoContentRepository.Entry entry = requiredEntry(entryId, true);
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
        return toAdminResponse(requiredEntry(entry.id(), false));
    }

    @Transactional
    public void delete(
            UUID entryId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        HomeVideoContentRepository.Entry entry = requiredEntry(entryId, true);
        verifyVersion(entry, expectedVersion);
        if (entry.status() == HomeVideoStatus.ONLINE) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "HOME_VIDEO_ONLINE",
                    "请先下架这条宣传视频，再执行删除");
        }
        if (!repository.deleteHidden(entry.id(), entry.version())) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "HOME_VIDEO_DELETE",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of());
    }

    @Transactional(readOnly = true)
    public Optional<PublishedHomeVideo> getPublished() {
        return repository.findPublishedEntry()
                .flatMap(entry -> repository.findRevision(entry.publishedRevisionId()))
                .filter(HomeVideoContentRepository.Revision::displayEnabled)
                .map(PublishedHomeVideo::new);
    }

    private AdminHomeVideoContentResponse saveRevision(
            HomeVideoContentRepository.Entry entry,
            SaveHomeVideoDraftRequest request,
            AdminPrincipal actor,
            String traceId,
            OffsetDateTime now) {
        requirePurpose(request.videoMediaId(), MediaPurpose.HOME_VIDEO);
        requirePurpose(request.coverMediaId(), MediaPurpose.HOME_VIDEO_COVER);
        int revisionNumber = repository.nextRevisionNumber(entry.id());
        HomeVideoContentRepository.Revision revision = repository.insertRevision(
                UUID.randomUUID(),
                entry.id(),
                revisionNumber,
                request.title().strip(),
                request.coverMediaId(),
                request.videoMediaId(),
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
        return toAdminResponse(requiredEntry(entry.id(), false));
    }

    private void requirePurpose(UUID mediaId, MediaPurpose expectedPurpose) {
        MediaAssetRepository.Asset asset = mediaService.requireReady(mediaId);
        if (asset.purpose() != expectedPurpose) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "MEDIA_PURPOSE_MISMATCH",
                    "所选文件不能用于这个位置");
        }
    }

    private HomeVideoContentRepository.Entry requiredEntry(UUID entryId, boolean forUpdate) {
        return repository.findEntry(entryId, forUpdate).orElseThrow(() -> new BusinessException(
                HttpStatus.NOT_FOUND,
                "CONTENT_NOT_FOUND",
                "未找到这条宣传视频"));
    }

    private void verifyVersion(
            HomeVideoContentRepository.Entry entry,
            long expectedVersion) {
        if (entry.version() != expectedVersion) throw versionConflict();
    }

    private BusinessException versionConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "CONTENT_VERSION_CONFLICT",
                "这条宣传视频已被其他人员修改，请刷新后重试");
    }

    private AdminHomeVideoListItemResponse toListItem(
            HomeVideoContentRepository.Entry entry) {
        HomeVideoContentRepository.Revision revision = repository
                .findRevision(entry.draftRevisionId())
                .or(() -> repository.findRevision(entry.publishedRevisionId()))
                .orElseThrow(() -> new IllegalStateException(
                        "Home video entry has no editable revision: " + entry.id()));
        return new AdminHomeVideoListItemResponse(
                entry.id(),
                entry.version(),
                revision.title(),
                revision.coverMediaId(),
                entry.status(),
                entry.draftRevisionId() != null
                        && !entry.draftRevisionId().equals(entry.publishedRevisionId()),
                entry.firstPublishedAt(),
                entry.updatedAt());
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
