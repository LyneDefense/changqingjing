package com.changqingjing.content;

import com.changqingjing.admin.api.content.AdminCompanyContentResponse;
import com.changqingjing.admin.api.content.AdminCompanyRevisionResponse;
import com.changqingjing.admin.api.content.SaveCompanyDraftRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.media.MediaAssetRepository;
import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompanyContentService {

    private final CompanyContentRepository repository;
    private final AdminAuditService auditService;
    private final MediaService mediaService;
    private final Clock clock = Clock.systemUTC();

    public CompanyContentService(
            CompanyContentRepository repository,
            AdminAuditService auditService,
            MediaService mediaService) {
        this.repository = repository;
        this.auditService = auditService;
        this.mediaService = mediaService;
    }

    @Transactional(readOnly = true)
    public AdminCompanyContentResponse getAdminContent() {
        return repository.findEntry(false)
                .map(this::toAdminResponse)
                .orElseGet(AdminCompanyContentResponse::empty);
    }

    @Transactional(readOnly = true)
    public AdminCompanyRevisionResponse getDraftPreview() {
        CompanyContentRepository.Entry entry = requiredEntry(false);
        return repository.findRevision(entry.draftRevisionId())
                .map(AdminCompanyRevisionResponse::from)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "CONTENT_DRAFT_NOT_FOUND",
                        "尚未保存公司介绍草稿"));
    }

    @Transactional
    public AdminCompanyContentResponse saveDraft(
            SaveCompanyDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        repository.lockSingletonCreation();
        CompanyContentRepository.Entry entry = repository.findEntry(true)
                .orElseGet(() -> repository.insertEntry(
                        UUID.randomUUID(), actor.accountId(), now()));
        verifyVersion(entry, request.expectedVersion());

        List<CompanyContentBlock> blocks = mergeLegacyGallery(
                request.blocks().stream()
                .map(CompanyContentBlock::normalized)
                .toList(),
                request.galleryMediaIds());
        validateContentBlocks(blocks);
        validateMedia(request.coverMediaId(), blocks);
        String title = request.title().strip();
        String summary = request.summary().strip();
        OffsetDateTime now = now();
        int revisionNumber = repository.nextRevisionNumber(entry.id());
        CompanyContentRepository.Revision revision = repository.insertRevision(
                UUID.randomUUID(),
                entry.id(),
                revisionNumber,
                title,
                summary,
                request.coverMediaId(),
                List.of(),
                blocks,
                actor.accountId(),
                now);
        repository.insertMediaReferences(
                revision.id(), request.coverMediaId(), List.of(), blocks);
        if (!repository.pointDraft(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "COMPANY_DRAFT_SAVE",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of("revisionNumber", revisionNumber));
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional
    public AdminCompanyContentResponse publish(
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        CompanyContentRepository.Entry entry = requiredEntry(true);
        verifyVersion(entry, expectedVersion);
        if (entry.draftRevisionId() == null) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "CONTENT_DRAFT_REQUIRED",
                    "请先保存公司介绍草稿");
        }
        OffsetDateTime now = now();
        if (!repository.publish(
                entry.id(),
                entry.draftRevisionId(),
                entry.version(),
                actor.accountId(),
                now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "COMPANY_PUBLISH",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of("revisionId", entry.draftRevisionId()));
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional
    public AdminCompanyContentResponse unpublish(
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        CompanyContentRepository.Entry entry = requiredEntry(true);
        verifyVersion(entry, expectedVersion);
        OffsetDateTime now = now();
        if (!repository.unpublish(
                entry.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "COMPANY_UNPUBLISH",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of());
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional(readOnly = true)
    public Optional<PublishedCompany> getPublished() {
        return repository.findEntry(false)
                .filter(entry -> "PUBLISHED".equals(entry.visibility()))
                .flatMap(entry -> repository.findRevision(entry.publishedRevisionId())
                        .map(revision -> new PublishedCompany(
                                revision, entry.firstPublishedAt())));
    }

    private CompanyContentRepository.Entry requiredEntry(boolean forUpdate) {
        return repository.findEntry(forUpdate)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "CONTENT_NOT_FOUND",
                        "公司介绍尚未创建"));
    }

    private void verifyVersion(
            CompanyContentRepository.Entry entry,
            long expectedVersion) {
        if (entry.version() != expectedVersion) {
            throw versionConflict();
        }
    }

    private List<CompanyContentBlock> mergeLegacyGallery(
            List<CompanyContentBlock> blocks,
            List<UUID> galleryMediaIds) {
        if (galleryMediaIds.isEmpty()) {
            return blocks;
        }
        List<CompanyContentBlock> merged = new ArrayList<>(blocks);
        int insertionIndex = 0;
        for (int index = 0; index < merged.size(); index++) {
            if (merged.get(index).type() == CompanyBlockType.PARAGRAPH) {
                insertionIndex = index + 1;
                break;
            }
        }
        merged.addAll(insertionIndex, galleryMediaIds.stream()
                .map(mediaId -> new CompanyContentBlock(
                        CompanyBlockType.IMAGE, null, mediaId, null))
                .toList());
        return List.copyOf(merged);
    }

    private void validateMedia(
            UUID coverMediaId,
            List<CompanyContentBlock> blocks) {
        if (coverMediaId != null) {
            requirePurpose(coverMediaId, MediaPurpose.COMPANY_COVER);
        }
        List<UUID> imageMediaIds = blocks.stream()
                .filter(block -> block.type() == CompanyBlockType.IMAGE)
                .map(CompanyContentBlock::mediaId)
                .toList();
        if (imageMediaIds.size() > 10) {
            throw invalidBlock("公司介绍插图最多 10 张");
        }
        if (new HashSet<>(imageMediaIds).size() != imageMediaIds.size()) {
            throw invalidBlock("公司介绍插图不能重复");
        }
        for (UUID mediaId : imageMediaIds) {
            requirePurpose(mediaId, MediaPurpose.COMPANY_IMAGE);
        }
    }

    private void validateContentBlocks(List<CompanyContentBlock> blocks) {
        CompanyBlockType previousType = null;
        for (int index = 0; index < blocks.size(); index++) {
            CompanyContentBlock block = blocks.get(index);
            if (block.type() == CompanyBlockType.HEADING) {
                if (index > 0 && previousType != CompanyBlockType.PARAGRAPH
                        && previousType != CompanyBlockType.IMAGE) {
                    throw invalidBlock("每个公司介绍板块必须包含标题和文字内容");
                }
                requireTextBlock(block);
            } else if (block.type() == CompanyBlockType.PARAGRAPH) {
                if (previousType != CompanyBlockType.HEADING) {
                    throw invalidBlock("文字内容必须紧跟在板块标题之后");
                }
                requireTextBlock(block);
            } else if (block.type() == CompanyBlockType.IMAGE) {
                if (previousType != CompanyBlockType.PARAGRAPH
                        && previousType != CompanyBlockType.IMAGE) {
                    throw invalidBlock("插图必须放在板块文字内容之后");
                }
                if (block.mediaId() == null) {
                    throw invalidBlock("公司介绍插图不能为空");
                }
            }
            previousType = block.type();
        }
        if (previousType != CompanyBlockType.PARAGRAPH
                && previousType != CompanyBlockType.IMAGE) {
            throw invalidBlock("每个公司介绍板块必须包含标题和文字内容");
        }
    }

    private void requireTextBlock(CompanyContentBlock block) {
        if (block.text() == null || block.text().isBlank() || block.mediaId() != null) {
            throw invalidBlock("公司介绍标题和文字内容不能为空");
        }
    }

    private void requirePurpose(UUID mediaId, MediaPurpose purpose) {
        MediaAssetRepository.Asset asset = mediaService.requireReady(mediaId);
        if (asset.purpose() != purpose) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "MEDIA_PURPOSE_MISMATCH",
                    "所选媒体不能用于当前内容位置");
        }
    }

    private BusinessException invalidBlock(String message) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "CONTENT_BLOCK_INVALID",
                message);
    }

    private BusinessException versionConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "CONTENT_VERSION_CONFLICT",
                "内容已被其他人员修改，请刷新后重试");
    }

    private AdminCompanyContentResponse toAdminResponse(
            CompanyContentRepository.Entry entry) {
        AdminCompanyRevisionResponse draft = repository
                .findRevision(entry.draftRevisionId())
                .map(AdminCompanyRevisionResponse::from)
                .orElse(null);
        AdminCompanyRevisionResponse published = repository
                .findRevision(entry.publishedRevisionId())
                .map(AdminCompanyRevisionResponse::from)
                .orElse(null);
        return new AdminCompanyContentResponse(
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

    public record PublishedCompany(
            CompanyContentRepository.Revision revision,
            OffsetDateTime firstPublishedAt) {
    }
}
