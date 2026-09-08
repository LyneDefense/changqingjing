package com.changqingjing.admin.api.content;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import com.changqingjing.content.CompanyContentService;
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
@RequestMapping("/api/v1/admin/contents/company")
public class AdminCompanyContentController {

    private final CompanyContentService contentService;

    public AdminCompanyContentController(CompanyContentService contentService) {
        this.contentService = contentService;
    }

    @GetMapping
    public ApiResponse<AdminCompanyContentResponse> get() {
        return ApiResponse.of(contentService.getAdminContent());
    }

    @PutMapping("/draft")
    public ApiResponse<AdminCompanyContentResponse> saveDraft(
            @Valid @RequestBody SaveCompanyDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.saveDraft(
                request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @GetMapping("/preview")
    public ApiResponse<AdminCompanyRevisionResponse> preview() {
        return ApiResponse.of(contentService.getDraftPreview());
    }

    @PostMapping("/publish")
    public ApiResponse<AdminCompanyContentResponse> publish(
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.publish(
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/unpublish")
    public ApiResponse<AdminCompanyContentResponse> unpublish(
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.unpublish(
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }
}
