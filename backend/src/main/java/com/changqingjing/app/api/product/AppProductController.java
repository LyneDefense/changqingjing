package com.changqingjing.app.api.product;

import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.content.ProductCatalogService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app")
public class AppProductController {

    private final ProductCatalogService service;

    public AppProductController(ProductCatalogService service) {
        this.service = service;
    }

    @GetMapping("/product-categories")
    public ApiResponse<List<AppProductCategoryResponse>> categories() {
        return ApiResponse.of(service.publishedCategories());
    }

    @GetMapping("/products")
    public ApiResponse<PageResponse<AppProductSummaryResponse>> products(
            @Valid AppProductQuery query) {
        return ApiResponse.of(service.publishedProducts(query));
    }

    @GetMapping("/products/{productId}")
    public ApiResponse<AppProductResponse> product(@PathVariable UUID productId) {
        return ApiResponse.of(service.publishedProduct(productId));
    }
}
