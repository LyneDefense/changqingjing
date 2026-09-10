package com.changqingjing.admin.api.content;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import com.changqingjing.content.HomeHeroContentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/contents/home-hero")
public class AdminHomeHeroContentController {

    private final HomeHeroContentService service;

    public AdminHomeHeroContentController(HomeHeroContentService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<AdminHomeHeroContentResponse> get() {
        return ApiResponse.of(service.getAdminContent());
    }

    @GetMapping("/preview")
    public ApiResponse<AdminHomeHeroRevisionResponse> preview() {
        return ApiResponse.of(service.preview());
    }

    @PutMapping("/draft")
    public ApiResponse<AdminHomeHeroContentResponse> saveDraft(
            @Valid @RequestBody SaveHomeHeroDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.saveDraft(
                request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/publish")
    public ApiResponse<AdminHomeHeroContentResponse> publish(
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.publish(
                request.expectedVersion(), actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/unpublish")
    public ApiResponse<AdminHomeHeroContentResponse> unpublish(
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.unpublish(
                request.expectedVersion(), actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }
}
