package com.changqingjing.admin.api.product;

import com.changqingjing.admin.api.content.ContentVersionRequest;
import com.changqingjing.admin.api.content.DeleteContentRequest;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import com.changqingjing.content.ProductCatalogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/products")
public class AdminProductController {

    private final ProductCatalogService service;

    public AdminProductController(ProductCatalogService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminProductListItemResponse>> search(
            @Valid AdminProductQuery query) {
        return ApiResponse.of(service.searchProducts(query));
    }

    @GetMapping("/{productId}")
    public ApiResponse<AdminProductContentResponse> get(@PathVariable UUID productId) {
        return ApiResponse.of(service.getProduct(productId));
    }

    @GetMapping("/{productId}/preview")
    public ApiResponse<AdminProductRevisionResponse> preview(@PathVariable UUID productId) {
        return ApiResponse.of(service.previewProduct(productId));
    }

    @PostMapping
    public ApiResponse<AdminProductContentResponse> create(
            @Valid @RequestBody SaveProductDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.createProduct(
                request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PutMapping("/{productId}/draft")
    public ApiResponse<AdminProductContentResponse> save(
            @PathVariable UUID productId,
            @Valid @RequestBody SaveProductDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.saveProduct(
                productId, request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/{productId}/publish")
    public ApiResponse<AdminProductContentResponse> publish(
            @PathVariable UUID productId,
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.publishProduct(
                productId, request.expectedVersion(), actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/{productId}/unpublish")
    public ApiResponse<AdminProductContentResponse> unpublish(
            @PathVariable UUID productId,
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.unpublishProduct(
                productId, request.expectedVersion(), actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @DeleteMapping("/{productId}")
    public ApiResponse<Map<String, Boolean>> delete(
            @PathVariable UUID productId,
            @Valid @RequestBody DeleteContentRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        service.deleteProduct(
                productId, request.expectedVersion(), actor,
                ApiTraceFilter.currentTraceId(servletRequest));
        return ApiResponse.of(Map.of("deleted", true));
    }
}
