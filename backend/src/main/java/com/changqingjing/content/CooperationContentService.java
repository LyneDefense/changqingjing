package com.changqingjing.content;

import com.changqingjing.admin.api.cooperation.AdminCooperationContentResponse;
import com.changqingjing.admin.api.cooperation.AdminCooperationRevisionResponse;
import com.changqingjing.admin.api.cooperation.SaveCooperationDraftRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.app.api.cooperation.AppCooperationResponse;
import com.changqingjing.app.api.cooperation.AppCooperationRevenueResponse;
import com.changqingjing.app.api.cooperation.AppCooperationValueResponse;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.media.MediaAssetRepository;
import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CooperationContentService {

    private final CooperationContentRepository repository;
    private final MediaService mediaService;
    private final AdminAuditService auditService;
    private final Clock clock = Clock.systemUTC();

    public CooperationContentService(
            CooperationContentRepository repository,
            MediaService mediaService,
            AdminAuditService auditService) {
        this.repository = repository;
        this.mediaService = mediaService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public AdminCooperationContentResponse getAdminContent() {
        return repository.findEntry(false)
                .map(this::toAdminResponse)
                .orElseGet(AdminCooperationContentResponse::empty);
    }

    @Transactional(readOnly = true)
    public AdminCooperationRevisionResponse preview() {
        CooperationContentRepository.Entry entry = requiredEntry(false);
        return repository.findRevision(entry.draftRevisionId())
                .map(AdminCooperationRevisionResponse::from)
                .orElseThrow(() -> business(
                        HttpStatus.NOT_FOUND,
                        "COOPERATION_DRAFT_NOT_FOUND",
                        "尚未保存合作权益草稿"));
    }

    @Transactional
    public AdminCooperationContentResponse saveDraft(
            SaveCooperationDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        repository.lockSingletonCreation();
        OffsetDateTime now = now();
        CooperationContentRepository.Entry entry = repository.findEntry(true)
                .orElseGet(() -> repository.insertEntry(
                        UUID.randomUUID(), actor.accountId(), now));
        verifyVersion(entry, request.expectedVersion());
        List<CooperationRevenueSection> revenueSections = request.revenueSections().stream()
                .map(CooperationRevenueSection::normalized)
                .sorted(Comparator.comparingInt(CooperationRevenueSection::displayOrder))
                .toList();
        List<CooperationValueSection> valueSections = request.valueSections().stream()
                .map(CooperationValueSection::normalized)
                .sorted(Comparator.comparingInt(CooperationValueSection::displayOrder))
                .toList();
        validateMedia(valueSections);
        int revisionNumber = repository.nextRevisionNumber(entry.id());
        CooperationContentRepository.Revision revision = repository.insertRevision(
                UUID.randomUUID(),
                entry.id(),
                revisionNumber,
                request.title().strip(),
                request.summary().strip(),
                revenueSections,
                valueSections,
                actor.accountId(),
                now);
        if (!repository.pointDraft(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "COOPERATION_DRAFT_SAVE",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of("revisionNumber", revisionNumber));
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional
    public AdminCooperationContentResponse publish(
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        CooperationContentRepository.Entry entry = requiredEntry(true);
        verifyVersion(entry, expectedVersion);
        CooperationContentRepository.Revision revision = repository
                .findRevision(entry.draftRevisionId())
                .orElseThrow(() -> business(
                        HttpStatus.BAD_REQUEST,
                        "COOPERATION_DRAFT_REQUIRED",
                        "请先保存合作权益草稿"));
        if (revision.revenueSections().isEmpty()) {
            throw business(
                    HttpStatus.BAD_REQUEST,
                    "COOPERATION_REVENUE_REQUIRED",
                    "请至少添加一个核心收益分类");
        }
        if (revision.valueSections().isEmpty()) {
            throw business(
                    HttpStatus.BAD_REQUEST,
                    "COOPERATION_VALUE_REQUIRED",
                    "请至少添加一个合作价值分类");
        }
        OffsetDateTime now = now();
        if (!repository.publish(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "COOPERATION_PUBLISH",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of("revisionNumber", revision.revisionNumber()));
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional
    public AdminCooperationContentResponse unpublish(
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        CooperationContentRepository.Entry entry = requiredEntry(true);
        verifyVersion(entry, expectedVersion);
        if (!repository.unpublish(
                entry.id(), entry.version(), actor.accountId(), now())) {
            throw versionConflict();
        }
        auditService.recordSuccess(
                actor.accountId(),
                "COOPERATION_UNPUBLISH",
                "CONTENT_ENTRY",
                entry.id(),
                traceId,
                Map.of());
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional(readOnly = true)
    public AppCooperationResponse getPublished() {
        CooperationContentRepository.Entry entry = repository.findEntry(false)
                .filter(value -> "PUBLISHED".equals(value.visibility()))
                .orElseThrow(() -> business(
                        HttpStatus.NOT_FOUND,
                        "COOPERATION_NOT_FOUND",
                        "合作权益内容正在准备中"));
        CooperationContentRepository.Revision revision = repository
                .findRevision(entry.publishedRevisionId())
                .orElseThrow();
        return new AppCooperationResponse(
                revision.title(),
                revision.summary(),
                revision.revenueSections().stream()
                        .map(section -> new AppCooperationRevenueResponse(
                                section.title(), section.description(), section.icon()))
                        .toList(),
                revision.valueSections().stream()
                        .map(section -> new AppCooperationValueResponse(
                                section.title(),
                                section.description(),
                                section.imageMediaId() == null
                                        ? null
                                        : mediaService.signReadyMedia(section.imageMediaId()).url(),
                                section.imageAltText()))
                        .toList());
    }

    private void validateMedia(List<CooperationValueSection> sections) {
        for (CooperationValueSection section : sections) {
            if (section.imageMediaId() == null) continue;
            MediaAssetRepository.Asset asset = mediaService.requireReady(section.imageMediaId());
            if (asset.purpose() != MediaPurpose.COOPERATION_IMAGE) {
                throw business(
                        HttpStatus.BAD_REQUEST,
                        "MEDIA_PURPOSE_MISMATCH",
                        "所选图片不能用于合作价值内容");
            }
        }
    }

    private AdminCooperationContentResponse toAdminResponse(
            CooperationContentRepository.Entry entry) {
        AdminCooperationRevisionResponse draft = repository
                .findRevision(entry.draftRevisionId())
                .map(AdminCooperationRevisionResponse::from)
                .orElse(null);
        AdminCooperationRevisionResponse published = repository
                .findRevision(entry.publishedRevisionId())
                .map(AdminCooperationRevisionResponse::from)
                .orElse(null);
        return new AdminCooperationContentResponse(
                entry.id(),
                entry.version(),
                entry.visibility(),
                entry.firstPublishedAt(),
                entry.updatedAt(),
                draft,
                published);
    }

    private CooperationContentRepository.Entry requiredEntry(boolean forUpdate) {
        return repository.findEntry(forUpdate)
                .orElseThrow(() -> business(
                        HttpStatus.NOT_FOUND,
                        "COOPERATION_NOT_FOUND",
                        "合作权益内容尚未创建"));
    }

    private void verifyVersion(
            CooperationContentRepository.Entry entry,
            long expectedVersion) {
        if (entry.version() != expectedVersion) throw versionConflict();
    }

    private BusinessException versionConflict() {
        return business(
                HttpStatus.CONFLICT,
                "CONTENT_VERSION_CONFLICT",
                "内容已被其他人员修改，请刷新后重试");
    }

    private BusinessException business(HttpStatus status, String code, String message) {
        return new BusinessException(status, code, message);
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
