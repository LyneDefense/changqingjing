package com.changqingjing.admin.api.content;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import com.changqingjing.content.HomeVideoContentService;
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
@RequestMapping("/api/v1/admin/contents/home-videos")
public class AdminHomeVideoContentController {

    private final HomeVideoContentService contentService;

    public AdminHomeVideoContentController(HomeVideoContentService contentService) {
        this.contentService = contentService;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminHomeVideoListItemResponse>> search(
            @Valid AdminHomeVideoQuery query) {
        return ApiResponse.of(contentService.search(query));
    }

    @PostMapping
    public ApiResponse<AdminHomeVideoContentResponse> create(
            @Valid @RequestBody SaveHomeVideoDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.create(
                request,
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @GetMapping("/{entryId}")
    public ApiResponse<AdminHomeVideoContentResponse> get(@PathVariable UUID entryId) {
        return ApiResponse.of(contentService.getAdminContent(entryId));
    }

    @PutMapping("/{entryId}/draft")
    public ApiResponse<AdminHomeVideoContentResponse> saveDraft(
            @PathVariable UUID entryId,
            @Valid @RequestBody SaveHomeVideoDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.saveDraft(
                entryId,
                request,
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @GetMapping("/{entryId}/preview")
    public ApiResponse<AdminHomeVideoRevisionResponse> preview(
            @PathVariable UUID entryId) {
        return ApiResponse.of(contentService.getDraftPreview(entryId));
    }

    @PostMapping("/{entryId}/publish")
    public ApiResponse<AdminHomeVideoContentResponse> publish(
            @PathVariable UUID entryId,
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.publish(
                entryId,
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/{entryId}/unpublish")
    public ApiResponse<AdminHomeVideoContentResponse> unpublish(
            @PathVariable UUID entryId,
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(contentService.unpublish(
                entryId,
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @DeleteMapping("/{entryId}")
    public ApiResponse<Map<String, Boolean>> delete(
            @PathVariable UUID entryId,
            @Valid @RequestBody DeleteContentRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        contentService.delete(
                entryId,
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest));
        return ApiResponse.of(Map.of("deleted", true));
    }
}
