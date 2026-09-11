package com.changqingjing.content;

import com.changqingjing.admin.api.product.AdminProductCategoryResponse;
import com.changqingjing.admin.api.product.AdminProductContentResponse;
import com.changqingjing.admin.api.product.AdminProductListItemResponse;
import com.changqingjing.admin.api.product.AdminProductQuery;
import com.changqingjing.admin.api.product.AdminProductRevisionResponse;
import com.changqingjing.admin.api.product.SaveProductCategoryRequest;
import com.changqingjing.admin.api.product.SaveProductDraftRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.app.api.product.AppProductBlockResponse;
import com.changqingjing.app.api.product.AppProductCategoryResponse;
import com.changqingjing.app.api.product.AppProductQuery;
import com.changqingjing.app.api.product.AppProductResponse;
import com.changqingjing.app.api.product.AppProductSummaryResponse;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.media.MediaAssetRepository;
import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductCatalogService {

    private final ProductCatalogRepository repository;
    private final MediaService mediaService;
    private final AdminAuditService auditService;
    private final Clock clock = Clock.systemUTC();

    public ProductCatalogService(
            ProductCatalogRepository repository,
            MediaService mediaService,
            AdminAuditService auditService) {
        this.repository = repository;
        this.mediaService = mediaService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<AdminProductCategoryResponse> adminCategories() {
        return repository.listCategories().stream()
                .map(this::adminCategory)
                .toList();
    }

    @Transactional
    public AdminProductCategoryResponse createCategory(
            SaveProductCategoryRequest request,
            AdminPrincipal actor,
            String traceId) {
        if (request.expectedVersion() != 0) throw versionConflict();
        OffsetDateTime now = now();
        ProductCatalogRepository.Entry entry = repository.insertEntry(
                ProductCatalogRepository.CATEGORY_KIND,
                UUID.randomUUID(),
                actor.accountId(),
                now);
        return saveCategoryRevision(entry, request, actor, traceId, now);
    }

    @Transactional
    public AdminProductCategoryResponse saveCategory(
            UUID categoryId,
            SaveProductCategoryRequest request,
            AdminPrincipal actor,
            String traceId) {
        ProductCatalogRepository.Entry entry = requiredCategory(categoryId, true);
        verifyVersion(entry, request.expectedVersion());
        return saveCategoryRevision(entry, request, actor, traceId, now());
    }

    @Transactional
    public AdminProductCategoryResponse publishCategory(
            UUID categoryId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        ProductCatalogRepository.Entry entry = requiredCategory(categoryId, true);
        verifyVersion(entry, expectedVersion);
        if (entry.draftRevisionId() == null) {
            throw business(HttpStatus.BAD_REQUEST, "CATEGORY_DRAFT_REQUIRED", "请先保存分类信息");
        }
        if (!repository.publish(
                entry.id(), entry.draftRevisionId(), expectedVersion, actor.accountId(), now())) {
            throw versionConflict();
        }
        audit(actor, "PRODUCT_CATEGORY_PUBLISH", entry.id(), traceId, Map.of());
        return adminCategory(requiredCategory(entry.id(), false));
    }

    @Transactional
    public AdminProductCategoryResponse unpublishCategory(
            UUID categoryId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        ProductCatalogRepository.Entry entry = requiredCategory(categoryId, true);
        verifyVersion(entry, expectedVersion);
        if (!repository.unpublish(entry.id(), expectedVersion, actor.accountId(), now())) {
            throw versionConflict();
        }
        audit(actor, "PRODUCT_CATEGORY_UNPUBLISH", entry.id(), traceId, Map.of());
        return adminCategory(requiredCategory(entry.id(), false));
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminProductListItemResponse> searchProducts(AdminProductQuery query) {
        List<AdminProductListItemResponse> items = repository.searchProducts(
                query.getKeyword(), query.getStatus(), query.getCategoryId(), query)
                .stream()
                .map(row -> new AdminProductListItemResponse(
                        row.entry().id(),
                        row.name(),
                        row.coverMediaId(),
                        row.categoryId(),
                        row.categoryName(),
                        status(row.entry()).name(),
                        row.displayOrder(),
                        hasChanges(row.entry()),
                        row.entry().version(),
                        row.entry().updatedAt()))
                .toList();
        long total = repository.countProducts(
                query.getKeyword(), query.getStatus(), query.getCategoryId());
        return PageResponse.of(items, query, total);
    }

    @Transactional(readOnly = true)
    public AdminProductContentResponse getProduct(UUID productId) {
        return toAdminProduct(requiredProduct(productId, false));
    }

    @Transactional(readOnly = true)
    public AdminProductRevisionResponse previewProduct(UUID productId) {
        ProductCatalogRepository.Entry entry = requiredProduct(productId, false);
        return repository.findProductRevision(entry.draftRevisionId())
                .map(this::toAdminRevision)
                .orElseThrow(() -> business(
                        HttpStatus.NOT_FOUND,
                        "PRODUCT_DRAFT_NOT_FOUND",
                        "这件福利产品还没有保存草稿"));
    }

    @Transactional
    public AdminProductContentResponse createProduct(
            SaveProductDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        if (request.expectedVersion() != 0) throw versionConflict();
        OffsetDateTime now = now();
        ProductCatalogRepository.Entry entry = repository.insertEntry(
                ProductCatalogRepository.PRODUCT_KIND,
                UUID.randomUUID(),
                actor.accountId(),
                now);
        return saveProductRevision(entry, request, actor, traceId, now);
    }

    @Transactional
    public AdminProductContentResponse saveProduct(
            UUID productId,
            SaveProductDraftRequest request,
            AdminPrincipal actor,
            String traceId) {
        ProductCatalogRepository.Entry entry = requiredProduct(productId, true);
        verifyVersion(entry, request.expectedVersion());
        return saveProductRevision(entry, request, actor, traceId, now());
    }

    @Transactional
    public AdminProductContentResponse publishProduct(
            UUID productId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        ProductCatalogRepository.Entry entry = requiredProduct(productId, true);
        verifyVersion(entry, expectedVersion);
        ProductCatalogRepository.ProductRevision revision = repository
                .findProductRevision(entry.draftRevisionId())
                .orElseThrow(() -> business(
                        HttpStatus.BAD_REQUEST,
                        "PRODUCT_DRAFT_REQUIRED",
                        "请先保存产品草稿"));
        validateForPublish(revision);
        if (!repository.publish(
                entry.id(), revision.id(), expectedVersion, actor.accountId(), now())) {
            throw versionConflict();
        }
        audit(actor, "PRODUCT_PUBLISH", entry.id(), traceId,
                Map.of("revisionNumber", revision.revisionNumber()));
        return toAdminProduct(requiredProduct(entry.id(), false));
    }

    @Transactional
    public AdminProductContentResponse unpublishProduct(
            UUID productId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        ProductCatalogRepository.Entry entry = requiredProduct(productId, true);
        verifyVersion(entry, expectedVersion);
        if (!repository.unpublish(entry.id(), expectedVersion, actor.accountId(), now())) {
            throw versionConflict();
        }
        audit(actor, "PRODUCT_UNPUBLISH", entry.id(), traceId, Map.of());
        return toAdminProduct(requiredProduct(entry.id(), false));
    }

    @Transactional
    public void deleteProduct(
            UUID productId,
            long expectedVersion,
            AdminPrincipal actor,
            String traceId) {
        ProductCatalogRepository.Entry entry = requiredProduct(productId, true);
        verifyVersion(entry, expectedVersion);
        if ("PUBLISHED".equals(entry.visibility())) {
            throw business(HttpStatus.CONFLICT, "PRODUCT_ONLINE", "请先下架产品，再删除记录");
        }
        if (!repository.deleteProduct(productId, expectedVersion)) throw versionConflict();
        audit(actor, "PRODUCT_DELETE", productId, traceId, Map.of());
    }
    private AdminProductContentResponse saveProductRevision(
            ProductCatalogRepository.Entry entry,
            SaveProductDraftRequest request,
            AdminPrincipal actor,
            String traceId,
            OffsetDateTime now) {
        if (request.categoryId() != null) requiredCategory(request.categoryId(), false);
        List<CompanyContentBlock> blocks = request.blocks().stream()
                .map(CompanyContentBlock::normalized)
                .toList();
        List<UUID> listImageMediaIds = List.copyOf(request.listImageMediaIds());
        validateMedia(request.coverMediaId(), listImageMediaIds, blocks);
        int revisionNumber = repository.nextRevisionNumber(entry.id());
        ProductCatalogRepository.ProductRevision revision = repository.insertProductRevision(
                UUID.randomUUID(),
                entry.id(),
                revisionNumber,
                request.name().strip(),
                request.summary().strip(),
                request.categoryId(),
                request.coverMediaId(),
                listImageMediaIds,
                blocks,
                request.specification() == null ? null : request.specification().strip(),
                request.displayOrder(),
                actor.accountId(),
                now);
        if (!repository.pointDraft(
                entry.id(), revision.id(), request.expectedVersion(), actor.accountId(), now)) {
            throw versionConflict();
        }
        audit(actor, "PRODUCT_DRAFT_SAVE", entry.id(), traceId,
                Map.of("revisionNumber", revisionNumber));
        return toAdminProduct(requiredProduct(entry.id(), false));
    }

    private AdminProductCategoryResponse saveCategoryRevision(
            ProductCatalogRepository.Entry entry,
            SaveProductCategoryRequest request,
            AdminPrincipal actor,
            String traceId,
            OffsetDateTime now) {
        int revisionNumber = repository.nextRevisionNumber(entry.id());
        ProductCatalogRepository.CategoryRevision revision = repository.insertCategoryRevision(
                UUID.randomUUID(),
                entry.id(),
                revisionNumber,
                request.name().strip(),
                request.displayOrder(),
                actor.accountId(),
                now);
        if (!repository.pointDraft(
                entry.id(), revision.id(), request.expectedVersion(), actor.accountId(), now)) {
            throw versionConflict();
        }
        audit(actor, "PRODUCT_CATEGORY_DRAFT_SAVE", entry.id(), traceId,
                Map.of("revisionNumber", revisionNumber));
        return adminCategory(requiredCategory(entry.id(), false));
    }

    private AdminProductCategoryResponse adminCategory(ProductCatalogRepository.Entry entry) {
        ProductCatalogRepository.CategoryRevision revision = repository
                .findCategoryRevision(entry.draftRevisionId())
                .or(() -> repository.findCategoryRevision(entry.publishedRevisionId()))
                .orElseThrow();
        return new AdminProductCategoryResponse(
                entry.id(),
                revision.name(),
                revision.displayOrder(),
                status(entry).name(),
                hasChanges(entry),
                entry.version(),
                entry.updatedAt());
    }

    private AdminProductContentResponse toAdminProduct(ProductCatalogRepository.Entry entry) {
        AdminProductRevisionResponse draft = repository
                .findProductRevision(entry.draftRevisionId())
                .map(this::toAdminRevision)
                .orElse(null);
        AdminProductRevisionResponse published = repository
                .findProductRevision(entry.publishedRevisionId())
                .map(this::toAdminRevision)
                .orElse(null);
        return new AdminProductContentResponse(
                entry.id(),
                entry.version(),
                entry.visibility(),
                entry.firstPublishedAt(),
                entry.updatedAt(),
                draft,
                published);
    }

    private AdminProductRevisionResponse toAdminRevision(
            ProductCatalogRepository.ProductRevision revision) {
        return new AdminProductRevisionResponse(
                revision.id(),
                revision.revisionNumber(),
                revision.name(),
                revision.summary(),
                revision.categoryId(),
                revision.coverMediaId(),
                revision.listImageMediaIds(),
                revision.blocks(),
                revision.specification(),
                revision.displayOrder(),
                revision.createdBy(),
                revision.createdAt());
    }

    private void validateMedia(
            UUID coverMediaId,
            List<UUID> listImageMediaIds,
            List<CompanyContentBlock> blocks) {
        if (new HashSet<>(listImageMediaIds).size() != listImageMediaIds.size()) {
            throw business(
                    HttpStatus.BAD_REQUEST,
                    "PRODUCT_IMAGE_DUPLICATED",
                    "产品图片不能重复");
        }
        if (coverMediaId != null && !listImageMediaIds.contains(coverMediaId)) {
            throw business(
                    HttpStatus.BAD_REQUEST,
                    "PRODUCT_COVER_INVALID",
                    "产品封面必须从已上传的产品图片中选择");
        }
        for (UUID mediaId : listImageMediaIds) requireProductImage(mediaId);
        for (CompanyContentBlock block : blocks) {
            if (block.type() == CompanyBlockType.IMAGE) {
                if (block.mediaId() == null || (block.text() != null && !block.text().isBlank())) {
                    throw business(
                            HttpStatus.BAD_REQUEST,
                            "CONTENT_BLOCK_INVALID",
                            "图片内容必须选择图片，且不能填写正文");
                }
                requireProductImage(block.mediaId());
            } else if (block.text() == null
                    || block.text().isBlank()
                    || block.mediaId() != null) {
                throw business(
                        HttpStatus.BAD_REQUEST,
                        "CONTENT_BLOCK_INVALID",
                        "小标题和正文必须填写文字，且不能绑定图片");
            }
        }
    }

    private void requireProductImage(UUID mediaId) {
        MediaAssetRepository.Asset asset = mediaService.requireReady(mediaId);
        if (asset.purpose() != MediaPurpose.PRODUCT_IMAGE) {
            throw business(
                    HttpStatus.BAD_REQUEST,
                    "MEDIA_PURPOSE_MISMATCH",
                    "所选图片不能用于福利产品");
        }
    }

    private void validateForPublish(ProductCatalogRepository.ProductRevision revision) {
        if (revision.coverMediaId() == null) {
            throw business(
                    HttpStatus.BAD_REQUEST,
                    "PRODUCT_COVER_REQUIRED",
                    "请先上传产品列表封面");
        }
    }

    private AppProductSummaryResponse toPublicSummary(
            ProductCatalogRepository.PublicProductRow row) {
        ProductCatalogRepository.ProductRevision revision = row.revision();
        return new AppProductSummaryResponse(
                row.entryId(),
                revision.name(),
                revision.summary(),
                mediaService.signReadyMedia(revision.coverMediaId()).url(),
                revision.categoryId(),
                row.categoryName());
    }

    private AppProductResponse toPublicProduct(
            ProductCatalogRepository.PublicProductRow row) {
        ProductCatalogRepository.ProductRevision revision = row.revision();
        List<AppProductBlockResponse> blocks = revision.blocks().stream()
                .map(block -> new AppProductBlockResponse(
                        block.type().name(),
                        block.text(),
                        block.mediaId() == null
                                ? null
                                : mediaService.signReadyMedia(block.mediaId()).url(),
                        block.altText()))
                .toList();
        return new AppProductResponse(
                row.entryId(),
                revision.name(),
                revision.summary(),
                mediaService.signReadyMedia(revision.coverMediaId()).url(),
                revision.categoryId(),
                row.categoryName(),
                blocks,
                revision.specification());
    }

    @Transactional(readOnly = true)
    public List<AppProductCategoryResponse> publishedCategories() {
        return repository.listPublishedCategories().stream()
                .map(row -> new AppProductCategoryResponse(
                        row.entryId(), row.revision().name()))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<AppProductSummaryResponse> publishedProducts(AppProductQuery query) {
        List<AppProductSummaryResponse> items = repository.listPublishedProducts(
                query.getKeyword(), query.getCategoryId(), query)
                .stream()
                .map(this::toPublicSummary)
                .toList();
        long total = repository.countPublishedProducts(
                query.getKeyword(), query.getCategoryId());
        return PageResponse.of(items, query, total);
    }

    @Transactional(readOnly = true)
    public AppProductResponse publishedProduct(UUID productId) {
        ProductCatalogRepository.PublicProductRow row = repository
                .findPublishedProduct(productId)
                .orElseThrow(() -> business(
                        HttpStatus.NOT_FOUND,
                        "PRODUCT_NOT_FOUND",
                        "该福利产品暂不可查看"));
        return toPublicProduct(row);
    }

    private ProductCatalogRepository.Entry requiredCategory(UUID id, boolean forUpdate) {
        return repository.findEntry(ProductCatalogRepository.CATEGORY_KIND, id, forUpdate)
                .orElseThrow(() -> business(
                        HttpStatus.NOT_FOUND,
                        "PRODUCT_CATEGORY_NOT_FOUND",
                        "产品分类不存在"));
    }

    private ProductCatalogRepository.Entry requiredProduct(UUID id, boolean forUpdate) {
        return repository.findEntry(ProductCatalogRepository.PRODUCT_KIND, id, forUpdate)
                .orElseThrow(() -> business(
                        HttpStatus.NOT_FOUND,
                        "PRODUCT_NOT_FOUND",
                        "福利产品不存在"));
    }

    private void verifyVersion(ProductCatalogRepository.Entry entry, long expectedVersion) {
        if (entry.version() != expectedVersion) throw versionConflict();
    }

    private CatalogPublicationStatus status(ProductCatalogRepository.Entry entry) {
        if ("PUBLISHED".equals(entry.visibility())) return CatalogPublicationStatus.ONLINE;
        return entry.firstPublishedAt() == null
                ? CatalogPublicationStatus.DRAFT
                : CatalogPublicationStatus.OFFLINE;
    }

    private boolean hasChanges(ProductCatalogRepository.Entry entry) {
        return entry.draftRevisionId() != null
                && !entry.draftRevisionId().equals(entry.publishedRevisionId());
    }

    private void audit(
            AdminPrincipal actor,
            String action,
            UUID targetId,
            String traceId,
            Map<String, ?> detail) {
        auditService.recordSuccess(
                actor.accountId(), action, "CONTENT_ENTRY", targetId, traceId, detail);
    }

    private BusinessException business(HttpStatus status, String code, String message) {
        return new BusinessException(status, code, message);
    }

    private BusinessException versionConflict() {
        return business(
                HttpStatus.CONFLICT,
                "CONTENT_VERSION_CONFLICT",
                "内容已被其他人员修改，请刷新后重试");
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
