package com.changqingjing.content;

import com.changqingjing.admin.api.scenic.AdminScenicContentResponse;
import com.changqingjing.admin.api.scenic.AdminScenicListItemResponse;
import com.changqingjing.admin.api.scenic.AdminScenicQuery;
import com.changqingjing.admin.api.scenic.AdminScenicRevisionResponse;
import com.changqingjing.admin.api.scenic.CreateMapSelectionRequest;
import com.changqingjing.admin.api.scenic.MapSelectionResponse;
import com.changqingjing.admin.api.scenic.SaveScenicDraftRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageQuery;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.media.MediaAssetRepository;
import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScenicContentService {

    private final ScenicContentRepository repository;
    private final MapSelectionRepository mapSelectionRepository;
    private final AdminAuditService auditService;
    private final MediaService mediaService;
    private final Clock clock = Clock.systemUTC();

    public ScenicContentService(
            ScenicContentRepository repository,
            MapSelectionRepository mapSelectionRepository,
            AdminAuditService auditService,
            MediaService mediaService) {
        this.repository = repository;
        this.mapSelectionRepository = mapSelectionRepository;
        this.auditService = auditService;
        this.mediaService = mediaService;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminScenicListItemResponse> search(AdminScenicQuery query) {
        List<AdminScenicListItemResponse> items = repository
                .search(query.getKeyword(), query.getStatus(), query)
                .stream()
                .map(this::toListItem)
                .toList();
        return PageResponse.of(
                items,
                query,
                repository.count(query.getKeyword(), query.getStatus()));
    }

    @Transactional(readOnly = true)
    public AdminScenicContentResponse getAdminContent(UUID entryId) {
        return toAdminResponse(requiredEntry(entryId, false));
    }

    @Transactional(readOnly = true)
    public AdminScenicRevisionResponse preview(UUID entryId) {
        ScenicContentRepository.Entry entry = requiredEntry(entryId, false);
        return repository.findRevision(entry.draftRevisionId())
                .map(AdminScenicRevisionResponse::from)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "CONTENT_DRAFT_NOT_FOUND",
                        "这条景区介绍还没有保存草稿"));
    }

    @Transactional
    public MapSelectionResponse confirmMapSelection(
            CreateMapSelectionRequest request,
            AdminPrincipal actor) {
        OffsetDateTime now = now();
        MapSelectionRepository.Selection selection = mapSelectionRepository.insert(
                UUID.randomUUID(),
                actor.accountId(),
                request.providerName().strip(),
                request.providerAddress().strip(),
                request.longitude(),
                request.latitude(),
                now.plusMinutes(30),
                now);
        return new MapSelectionResponse(
                selection.id(),
                selection.providerName(),
                selection.providerAddress(),
                selection.longitude(),
                selection.latitude(),
                selection.coordinateSystem(),
                selection.expiresAt());
    }

    @Transactional
    public AdminScenicContentResponse create(
            SaveScenicDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        if (request.expectedVersion() != 0) throw versionConflict();
        OffsetDateTime now = now();
        ScenicContentRepository.Entry entry = repository.insertEntry(
                UUID.randomUUID(), actor.accountId(), now);
        return saveRevision(entry, request, actor, traceId, now);
    }

    @Transactional
    public AdminScenicContentResponse saveDraft(
            UUID entryId,
            SaveScenicDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        ScenicContentRepository.Entry entry = requiredEntry(entryId, true);
        verifyVersion(entry, request.expectedVersion());
        return saveRevision(entry, request, actor, traceId, now());
    }

    @Transactional
    public AdminScenicContentResponse publish(
            UUID entryId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        ScenicContentRepository.Entry entry = requiredEntry(entryId, true);
        verifyVersion(entry, expectedVersion);
        ScenicContentRepository.Revision revision = repository
                .findRevision(entry.draftRevisionId())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.CONFLICT,
                        "CONTENT_DRAFT_REQUIRED",
                        "请先保存这条景区介绍"));
        validateForPublish(revision);
        OffsetDateTime now = now();
        if (!repository.publish(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "SCENIC_PUBLISH",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of("revisionId", revision.id()));
        return toAdminResponse(requiredEntry(entry.id(), false));
    }

    @Transactional
    public AdminScenicContentResponse unpublish(
            UUID entryId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        ScenicContentRepository.Entry entry = requiredEntry(entryId, true);
        verifyVersion(entry, expectedVersion);
        OffsetDateTime now = now();
        if (!repository.unpublish(
                entry.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "SCENIC_UNPUBLISH",
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
        ScenicContentRepository.Entry entry = requiredEntry(entryId, true);
        verifyVersion(entry, expectedVersion);
        if (entry.status() == ScenicPublicationStatus.ONLINE) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "SCENIC_ONLINE",
                    "请先下架这条景区介绍，再执行删除");
        }
        if (!repository.deleteHidden(entry.id(), entry.version())) throw versionConflict();
        auditService.recordSuccess(
                actor.accountId(),
                "SCENIC_DELETE",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of());
    }

    @Transactional(readOnly = true)
    public PageResponse<PublishedScenic> getPublished(PageQuery query) {
        List<PublishedScenic> items = repository.findPublished(query).stream()
                .map(this::toPublished)
                .toList();
        return PageResponse.of(items, query, repository.countPublished());
    }

    @Transactional(readOnly = true)
    public PublishedScenic getPublished(UUID entryId) {
        ScenicContentRepository.Entry entry = requiredEntry(entryId, false);
        if (!"PUBLISHED".equals(entry.visibility())) throw notAvailable();
        return toPublished(entry);
    }

    @Transactional
    public long recordView(UUID entryId, UUID viewId) {
        ScenicContentRepository.Entry entry = requiredEntry(entryId, false);
        if (!"PUBLISHED".equals(entry.visibility())) throw notAvailable();
        boolean inserted = repository.recordView(entryId, viewId, now());
        return inserted ? entry.viewCount() + 1 : entry.viewCount();
    }

    private AdminScenicContentResponse saveRevision(
            ScenicContentRepository.Entry entry,
            SaveScenicDraftRequest request,
            AdminPrincipal actor,
            String traceId,
            OffsetDateTime now) {
        List<ScenicContentBlock> blocks = request.blocks().stream()
                .map(ScenicContentBlock::normalized)
                .toList();
        validateMedia(request.coverMediaId(), blocks);
        ScenicContentRepository.Revision current = repository
                .findRevision(entry.draftRevisionId())
                .or(() -> repository.findRevision(entry.publishedRevisionId()))
                .orElse(null);
        ScenicLocation location = resolveLocation(request, current, actor, now);
        int revisionNumber = repository.nextRevisionNumber(entry.id());
        ScenicContentRepository.Revision revision = repository.insertRevision(
                UUID.randomUUID(),
                entry.id(),
                revisionNumber,
                request.title().strip(),
                request.summary().strip(),
                request.coverMediaId(),
                blocks,
                request.openStatus(),
                request.displayOrder(),
                location,
                actor.accountId(),
                now);
        if (!repository.pointDraft(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "SCENIC_DRAFT_SAVE",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of("revisionNumber", revisionNumber));
        return toAdminResponse(requiredEntry(entry.id(), false));
    }

    private ScenicLocation resolveLocation(
            SaveScenicDraftRequest request,
            ScenicContentRepository.Revision current,
            AdminPrincipal actor,
            OffsetDateTime now) {
        String requestedName = request.displayName() == null
                ? ""
                : request.displayName().strip();
        if (request.locationSelectionId() != null) {
            MapSelectionRepository.Selection selection = mapSelectionRepository
                    .findValid(request.locationSelectionId(), actor.accountId(), now)
                    .orElseThrow(() -> new BusinessException(
                            HttpStatus.BAD_REQUEST,
                            "MAP_SELECTION_INVALID",
                            "地图选点已失效，请重新选择并确认位置"));
            String displayName = requestedName.isBlank()
                    ? selection.providerName()
                    : requestedName;
            return new ScenicLocation(
                    selection.providerName(),
                    selection.providerAddress(),
                    displayName,
                    !displayName.equals(selection.providerName()),
                    selection.longitude(),
                    selection.latitude(),
                    selection.coordinateSystem());
        }
        if (current == null || current.location() == null) return null;
        ScenicLocation previous = current.location();
        String displayName = requestedName.isBlank() ? previous.displayName() : requestedName;
        return new ScenicLocation(
                previous.providerName(),
                previous.providerAddress(),
                displayName,
                !displayName.equals(previous.providerName()),
                previous.longitude(),
                previous.latitude(),
                previous.coordinateSystem());
    }

    private void validateForPublish(ScenicContentRepository.Revision revision) {
        if (revision.coverMediaId() == null) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "SCENIC_COVER_REQUIRED",
                    "请先上传景区列表封面");
        }
        if (revision.blocks().isEmpty()) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "SCENIC_CONTENT_REQUIRED",
                    "请至少添加一段景区详细内容");
        }
    }

    private void validateMedia(UUID coverMediaId, List<ScenicContentBlock> blocks) {
        if (coverMediaId != null) requirePurpose(coverMediaId, MediaPurpose.SCENIC_IMAGE);
        for (ScenicContentBlock block : blocks) {
            if (block.type() == CompanyBlockType.IMAGE) {
                if (block.mediaId() == null || (block.text() != null && !block.text().isBlank())) {
                    throw invalidBlock("图片内容必须选择一张图片，且不能填写正文");
                }
                requirePurpose(block.mediaId(), MediaPurpose.SCENIC_IMAGE);
            } else if (block.text() == null
                    || block.text().isBlank()
                    || block.mediaId() != null) {
                throw invalidBlock("小标题和正文必须填写文字，且不能绑定图片");
            }
        }
    }

    private void requirePurpose(UUID mediaId, MediaPurpose purpose) {
        MediaAssetRepository.Asset asset = mediaService.requireReady(mediaId);
        if (asset.purpose() != purpose) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "MEDIA_PURPOSE_MISMATCH",
                    "所选图片不能用于景区内容");
        }
    }

    private AdminScenicListItemResponse toListItem(ScenicContentRepository.Entry entry) {
        ScenicContentRepository.Revision revision = repository
                .findRevision(entry.draftRevisionId())
                .or(() -> repository.findRevision(entry.publishedRevisionId()))
                .orElseThrow(() -> new IllegalStateException(
                        "Scenic entry has no editable revision: " + entry.id()));
        return new AdminScenicListItemResponse(
                entry.id(),
                entry.version(),
                revision.title(),
                revision.coverMediaId(),
                entry.status(),
                revision.openStatus(),
                revision.displayOrder(),
                entry.draftRevisionId() != null
                        && !entry.draftRevisionId().equals(entry.publishedRevisionId()),
                entry.viewCount(),
                entry.updatedAt());
    }

    private AdminScenicContentResponse toAdminResponse(ScenicContentRepository.Entry entry) {
        AdminScenicRevisionResponse draft = repository.findRevision(entry.draftRevisionId())
                .map(AdminScenicRevisionResponse::from)
                .orElse(null);
        AdminScenicRevisionResponse published = repository.findRevision(entry.publishedRevisionId())
                .map(AdminScenicRevisionResponse::from)
                .orElse(null);
        return new AdminScenicContentResponse(
                entry.id(),
                entry.version(),
                entry.visibility(),
                entry.firstPublishedAt(),
                entry.updatedAt(),
                draft,
                published);
    }

    private PublishedScenic toPublished(ScenicContentRepository.Entry entry) {
        ScenicContentRepository.Revision revision = repository
                .findRevision(entry.publishedRevisionId())
                .orElseThrow(this::notAvailable);
        return new PublishedScenic(
                entry.id(), revision, entry.firstPublishedAt(), entry.viewCount());
    }

    private ScenicContentRepository.Entry requiredEntry(UUID entryId, boolean forUpdate) {
        return repository.findEntry(entryId, forUpdate).orElseThrow(() -> new BusinessException(
                HttpStatus.NOT_FOUND,
                "CONTENT_NOT_FOUND",
                "未找到这条景区介绍"));
    }

    private void verifyVersion(ScenicContentRepository.Entry entry, long expectedVersion) {
        if (entry.version() != expectedVersion) throw versionConflict();
    }

    private BusinessException versionConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "CONTENT_VERSION_CONFLICT",
                "这条景区介绍已被其他人员修改，请刷新后重试");
    }

    private BusinessException invalidBlock(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "CONTENT_BLOCK_INVALID", message);
    }

    private BusinessException notAvailable() {
        return new BusinessException(
                HttpStatus.NOT_FOUND,
                "CONTENT_NOT_AVAILABLE",
                "这条景区介绍暂不可查看");
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }

    public record PublishedScenic(
            UUID id,
            ScenicContentRepository.Revision revision,
            OffsetDateTime firstPublishedAt,
            long viewCount) {
    }
}
