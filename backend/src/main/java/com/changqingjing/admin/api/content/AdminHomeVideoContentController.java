package com.changqingjing.admin.api.content;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import com.changqingjing.content.HomeVideoContentService;
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
@RequestMapping("/api/v1/admin/contents/home-video")
public class AdminHomeVideoContentController {

    private final HomeVideoContentService contentService;

    public AdminHomeVideoContentController(HomeVideoContentService contentService) {
        this.contentService = contentService;
    }

    @GetMapping
    public ApiResponse<AdminHomeVideoContentResponse> get() {
        return ApiResponse.of(contentService.getAdminContent());
    }

    @PutMapping("/draft")
    public ApiResponse<AdminHomeVideoContentResponse> saveDraft(
            @Valid @RequestBody SaveHomeVideoDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.saveDraft(
                request,
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @GetMapping("/preview")
    public ApiResponse<AdminHomeVideoRevisionResponse> preview() {
        return ApiResponse.of(contentService.getDraftPreview());
    }

    @PostMapping("/publish")
    public ApiResponse<AdminHomeVideoContentResponse> publish(
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.publish(
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/unpublish")
    public ApiResponse<AdminHomeVideoContentResponse> unpublish(
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.unpublish(
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }
}
