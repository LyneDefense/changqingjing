package com.changqingjing.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.changqingjing.admin.api.product.AdminProductQuery;
import com.changqingjing.admin.api.product.SaveProductCategoryRequest;
import com.changqingjing.admin.api.product.SaveProductDraftRequest;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.app.api.product.AppProductQuery;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaStorage;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "app.admin.password.bcrypt-strength=4")
@Testcontainers
class ProductCatalogServiceIntegrationTest {

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
    private ProductCatalogService catalogService;

    @Autowired
    private AdminBootstrapService bootstrapService;

    @Autowired
    private AdminAccountRepository accountRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private MediaStorage mediaStorage;

    @BeforeEach
    void resetDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_account CASCADE");
        when(mediaStorage.signRead(any(String.class), any(Duration.class)))
                .thenAnswer(invocation -> new MediaStorage.SignedObjectUrl(
                        "https://media.example/" + invocation.getArgument(0),
                        OffsetDateTime.now().plusMinutes(15)));
    }

    @Test
    void publishesSearchableProductWithOrderedImageAndTextContent() {
        AdminPrincipal actor = bootstrapAdmin();
        var category = catalogService.createCategory(
                new SaveProductCategoryRequest("康养好物", 1, 0), actor, "category-create");
        category = catalogService.publishCategory(
                category.id(), category.version(), actor, "category-publish");

        UUID coverId = insertReadyImage(actor.accountId());
        UUID alternateCoverId = insertReadyImage(actor.accountId());
        UUID firstImageId = insertReadyImage(actor.accountId());
        UUID secondImageId = insertReadyImage(actor.accountId());
        var draft = catalogService.createProduct(
                new SaveProductDraftRequest(
                        "九宫山草本香囊",
                        "来自九宫山的手作草本香囊",
                        category.id(),
                        coverId,
                        List.of(coverId, alternateCoverId),
                        List.of(
                                new CompanyContentBlock(
                                        CompanyBlockType.HEADING, "产品故事", null, null),
                                new CompanyContentBlock(
                                        CompanyBlockType.IMAGE, null, firstImageId, "香囊正面"),
                                new CompanyContentBlock(
                                        CompanyBlockType.PARAGRAPH, "当地手艺人手工制作", null, null),
                                new CompanyContentBlock(
                                        CompanyBlockType.IMAGE, null, secondImageId, "香囊细节")),
                        "每盒 2 枚",
                        2,
                        0),
                actor,
                "product-create");
        assertThat(draft.draft().listImageMediaIds())
                .containsExactly(coverId, alternateCoverId);
        catalogService.publishProduct(
                draft.id(), draft.version(), actor, "product-publish");

        AppProductQuery publicQuery = new AppProductQuery();
        publicQuery.setKeyword("香囊");
        publicQuery.setCategoryId(category.id());
        var products = catalogService.publishedProducts(publicQuery);
        assertThat(products.total()).isEqualTo(1);
        assertThat(products.items().get(0).coverUrl()).contains(coverId.toString());

        var product = catalogService.publishedProduct(draft.id());
        assertThat(product.imageUrls()).hasSize(2);
        assertThat(product.imageUrls().get(0)).contains(coverId.toString());
        assertThat(product.imageUrls().get(1)).contains(alternateCoverId.toString());
        assertThat(product.blocks()).hasSize(4);
        assertThat(product.blocks().get(1).imageUrl()).contains(firstImageId.toString());
        assertThat(product.blocks().get(3).imageUrl()).contains(secondImageId.toString());
        assertThat(product.specification()).isEqualTo("每盒 2 枚");
    }

    @Test
    void categoryVisibilityDoesNotTakeAnOnlineProductOffline() {
        AdminPrincipal actor = bootstrapAdmin();
        var category = catalogService.createCategory(
                new SaveProductCategoryRequest("时令特产", 1, 0), actor, "category-create");
        category = catalogService.publishCategory(
                category.id(), category.version(), actor, "category-publish");
        UUID coverId = insertReadyImage(actor.accountId());
        var draft = catalogService.createProduct(
                productRequest(category.id(), coverId, 0), actor, "product-create");
        var online = catalogService.publishProduct(
                draft.id(), draft.version(), actor, "product-publish");

        catalogService.unpublishCategory(
                category.id(), category.version(), actor, "category-unpublish");

        assertThat(catalogService.publishedCategories()).isEmpty();
        AppProductQuery allProducts = new AppProductQuery();
        assertThat(catalogService.publishedProducts(allProducts).items())
                .extracting(item -> item.id())
                .containsExactly(draft.id());
        AppProductQuery hiddenCategory = new AppProductQuery();
        hiddenCategory.setCategoryId(category.id());
        assertThat(catalogService.publishedProducts(hiddenCategory).items()).isEmpty();

        catalogService.unpublishProduct(
                draft.id(), online.version(), actor, "product-unpublish");
        assertThatThrownBy(() -> catalogService.publishedProduct(draft.id()))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("PRODUCT_NOT_FOUND");
    }

    @Test
    void filtersAdministrationStatusAndRejectsIncompletePublication() {
        AdminPrincipal actor = bootstrapAdmin();
        var incomplete = catalogService.createProduct(
                new SaveProductDraftRequest(
                        "待完善产品", "还没有图片", null, null, List.of(), List.of(), null, 0, 0),
                actor,
                "incomplete-create");
        assertThatThrownBy(() -> catalogService.publishProduct(
                incomplete.id(), incomplete.version(), actor, "incomplete-publish"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("PRODUCT_COVER_REQUIRED");

        AdminProductQuery draftQuery = new AdminProductQuery();
        draftQuery.setStatus(CatalogPublicationStatus.DRAFT);
        assertThat(catalogService.searchProducts(draftQuery).items())
                .extracting(item -> item.name())
                .containsExactly("待完善产品");
    }

    private SaveProductDraftRequest productRequest(
            UUID categoryId,
            UUID coverId,
            long version) {
        return new SaveProductDraftRequest(
                "通山山茶",
                "本地山茶纯展示介绍",
                categoryId,
                coverId,
                List.of(coverId),
                List.of(new CompanyContentBlock(
                        CompanyBlockType.PARAGRAPH, "生长于通山山林", null, null)),
                null,
                1,
                version);
    }

    @Test
    void publishesProductWithoutOptionalDetailContent() {
        AdminPrincipal actor = bootstrapAdmin();
        UUID coverId = insertReadyImage(actor.accountId());
        var draft = catalogService.createProduct(
                new SaveProductDraftRequest(
                        "无详情产品",
                        "仅展示基础信息",
                        null,
                        coverId,
                        List.of(coverId),
                        List.of(),
                        null,
                        0,
                        0),
                actor,
                "product-without-detail");

        catalogService.publishProduct(
                draft.id(), draft.version(), actor, "product-without-detail-publish");

        var product = catalogService.publishedProduct(draft.id());
        assertThat(product.blocks()).isEmpty();
        assertThat(product.specification()).isNull();
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
                MediaPurpose.PRODUCT_IMAGE.name(),
                actorId);
        return id;
    }

    private AdminPrincipal bootstrapAdmin() {
        UUID id = bootstrapService.createFirstAdmin(
                "product.admin", "产品管理员", "ProductAdmin2026", "bootstrap");
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
