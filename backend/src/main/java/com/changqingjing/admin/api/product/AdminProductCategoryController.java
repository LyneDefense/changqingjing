package com.changqingjing.admin.api.product;

import com.changqingjing.admin.api.content.ContentVersionRequest;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import com.changqingjing.content.ProductCatalogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/product-categories")
public class AdminProductCategoryController {

    private final ProductCatalogService service;

    public AdminProductCategoryController(ProductCatalogService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AdminProductCategoryResponse>> list() {
        return ApiResponse.of(service.adminCategories());
    }

    @PostMapping
    public ApiResponse<AdminProductCategoryResponse> create(
            @Valid @RequestBody SaveProductCategoryRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.createCategory(
                request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PutMapping("/{categoryId}/draft")
    public ApiResponse<AdminProductCategoryResponse> save(
            @PathVariable UUID categoryId,
            @Valid @RequestBody SaveProductCategoryRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.saveCategory(
                categoryId, request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/{categoryId}/publish")
    public ApiResponse<AdminProductCategoryResponse> publish(
            @PathVariable UUID categoryId,
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.publishCategory(
                categoryId, request.expectedVersion(), actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/{categoryId}/unpublish")
    public ApiResponse<AdminProductCategoryResponse> unpublish(
            @PathVariable UUID categoryId,
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.unpublishCategory(
                categoryId, request.expectedVersion(), actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }
}
