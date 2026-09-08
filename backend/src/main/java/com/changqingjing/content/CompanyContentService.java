package com.changqingjing.content;

import com.changqingjing.admin.api.content.AdminCompanyContentResponse;
import com.changqingjing.admin.api.content.AdminCompanyRevisionResponse;
import com.changqingjing.admin.api.content.SaveCompanyDraftRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
    private final Clock clock = Clock.systemUTC();

    public CompanyContentService(
            CompanyContentRepository repository,
            AdminAuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
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

        List<CompanyContentBlock> blocks = request.blocks().stream()
                .map(CompanyContentBlock::normalized)
                .toList();
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
                blocks,
                actor.accountId(),
                now);
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
