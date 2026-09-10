package com.changqingjing.content;

import com.changqingjing.admin.api.content.AdminHomeHeroContentResponse;
import com.changqingjing.admin.api.content.AdminHomeHeroRevisionResponse;
import com.changqingjing.admin.api.content.SaveHomeHeroDraftRequest;
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
public class HomeHeroContentService {

    private final HomeHeroContentRepository repository;
    private final MediaService mediaService;
    private final AdminAuditService auditService;
    private final Clock clock = Clock.systemUTC();

    public HomeHeroContentService(
            HomeHeroContentRepository repository,
            MediaService mediaService,
            AdminAuditService auditService) {
        this.repository = repository;
        this.mediaService = mediaService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public AdminHomeHeroContentResponse getAdminContent() {
        return repository.findEntry(false)
                .map(this::toAdminResponse)
                .orElseGet(AdminHomeHeroContentResponse::empty);
    }

    @Transactional(readOnly = true)
    public AdminHomeHeroRevisionResponse preview() {
        HomeHeroContentRepository.Entry entry = requiredEntry(false);
        return repository.findRevision(entry.draftRevisionId())
                .map(AdminHomeHeroRevisionResponse::from)
                .orElseThrow(() -> business(HttpStatus.NOT_FOUND,
                        "HOME_HERO_DRAFT_NOT_FOUND", "尚未保存头图草稿"));
    }

    @Transactional
    public AdminHomeHeroContentResponse saveDraft(
            SaveHomeHeroDraftRequest request, AdminPrincipal actor, String traceId) {
        requireHeroImage(request.coverMediaId());
        repository.lockSingletonCreation();
        OffsetDateTime now = now();
        HomeHeroContentRepository.Entry entry = repository.findEntry(true)
                .orElseGet(() -> repository.insertEntry(UUID.randomUUID(), actor.accountId(), now));
        verifyVersion(entry, request.expectedVersion());
        int revisionNumber = repository.nextRevisionNumber(entry.id());
        HomeHeroContentRepository.Revision revision = repository.insertRevision(
                UUID.randomUUID(), entry.id(), revisionNumber,
                normalize(request.title()), normalize(request.subtitle()), request.coverMediaId(),
                request.focusX(), request.focusY(), actor.accountId(), now);
        if (!repository.pointDraft(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(actor.accountId(), "HOME_HERO_DRAFT_SAVE",
                "CONTENT_ENTRY", entry.id(), traceId, Map.of("revisionNumber", revisionNumber));
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional
    public AdminHomeHeroContentResponse publish(
            long expectedVersion, AdminPrincipal actor, String traceId) {
        HomeHeroContentRepository.Entry entry = requiredEntry(true);
        verifyVersion(entry, expectedVersion);
        HomeHeroContentRepository.Revision revision = repository
                .findRevision(entry.draftRevisionId())
                .orElseThrow(() -> business(HttpStatus.CONFLICT,
                        "HOME_HERO_DRAFT_REQUIRED", "请先保存头图草稿"));
        requireHeroImage(revision.coverMediaId());
        OffsetDateTime now = now();
        if (!repository.publish(
                entry.id(), revision.id(), entry.version(), actor.accountId(), now)) {
            throw versionConflict();
        }
        auditService.recordSuccess(actor.accountId(), "HOME_HERO_PUBLISH",
                "CONTENT_ENTRY", entry.id(), traceId, Map.of("revisionId", revision.id()));
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional
    public AdminHomeHeroContentResponse unpublish(
            long expectedVersion, AdminPrincipal actor, String traceId) {
        HomeHeroContentRepository.Entry entry = requiredEntry(true);
        verifyVersion(entry, expectedVersion);
        if (!repository.unpublish(entry.id(), entry.version(), actor.accountId(), now())) {
            throw versionConflict();
        }
        auditService.recordSuccess(actor.accountId(), "HOME_HERO_UNPUBLISH",
                "CONTENT_ENTRY", entry.id(), traceId, Map.of());
        return toAdminResponse(requiredEntry(false));
    }

    @Transactional(readOnly = true)
    public Optional<PublishedHomeHero> getPublished() {
        return repository.findEntry(false)
                .filter(entry -> "PUBLISHED".equals(entry.visibility()))
                .flatMap(entry -> repository.findRevision(entry.publishedRevisionId()))
                .map(PublishedHomeHero::new);
    }

    private void requireHeroImage(UUID mediaId) {
        MediaAssetRepository.Asset asset = mediaService.requireReady(mediaId);
        if (asset.purpose() != MediaPurpose.HOME_HERO) {
            throw business(HttpStatus.BAD_REQUEST, "MEDIA_PURPOSE_MISMATCH",
                    "所选图片不能用于首页头图");
        }
    }

    private AdminHomeHeroContentResponse toAdminResponse(HomeHeroContentRepository.Entry entry) {
        return new AdminHomeHeroContentResponse(
                entry.id(), entry.version(), entry.visibility(), entry.firstPublishedAt(),
                entry.updatedAt(),
                repository.findRevision(entry.draftRevisionId())
                        .map(AdminHomeHeroRevisionResponse::from).orElse(null),
                repository.findRevision(entry.publishedRevisionId())
                        .map(AdminHomeHeroRevisionResponse::from).orElse(null));
    }

    private HomeHeroContentRepository.Entry requiredEntry(boolean forUpdate) {
        return repository.findEntry(forUpdate).orElseThrow(() -> business(
                HttpStatus.NOT_FOUND, "HOME_HERO_NOT_FOUND", "首页头图尚未创建"));
    }

    private void verifyVersion(HomeHeroContentRepository.Entry entry, long expectedVersion) {
        if (entry.version() != expectedVersion) throw versionConflict();
    }

    private BusinessException versionConflict() {
        return business(HttpStatus.CONFLICT, "CONTENT_VERSION_CONFLICT",
                "头图已被其他人员修改，请刷新后重试");
    }

    private BusinessException business(HttpStatus status, String code, String message) {
        return new BusinessException(status, code, message);
    }

    private String normalize(String value) {
        return value == null ? "" : value.strip();
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    public record PublishedHomeHero(HomeHeroContentRepository.Revision revision) {
    }
}
