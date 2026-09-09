package com.changqingjing.admin.api.scenic;

import com.changqingjing.admin.api.content.ContentVersionRequest;
import com.changqingjing.admin.api.content.DeleteContentRequest;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import com.changqingjing.content.ScenicContentService;
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
@RequestMapping("/api/v1/admin/scenics")
public class AdminScenicController {

    private final ScenicContentService scenicService;

    public AdminScenicController(ScenicContentService scenicService) {
        this.scenicService = scenicService;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminScenicListItemResponse>> search(
            @Valid AdminScenicQuery query) {
        return ApiResponse.of(scenicService.search(query));
    }

    @PostMapping
    public ApiResponse<AdminScenicContentResponse> create(
            @Valid @RequestBody SaveScenicDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(scenicService.create(
                request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @GetMapping("/{entryId}")
    public ApiResponse<AdminScenicContentResponse> get(@PathVariable UUID entryId) {
        return ApiResponse.of(scenicService.getAdminContent(entryId));
    }

    @PutMapping("/{entryId}/draft")
    public ApiResponse<AdminScenicContentResponse> saveDraft(
            @PathVariable UUID entryId,
            @Valid @RequestBody SaveScenicDraftRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(scenicService.saveDraft(
                entryId, request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @GetMapping("/{entryId}/preview")
    public ApiResponse<AdminScenicRevisionResponse> preview(@PathVariable UUID entryId) {
        return ApiResponse.of(scenicService.preview(entryId));
    }

    @PostMapping("/{entryId}/publish")
    public ApiResponse<AdminScenicContentResponse> publish(
            @PathVariable UUID entryId,
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(scenicService.publish(
                entryId,
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/{entryId}/unpublish")
    public ApiResponse<AdminScenicContentResponse> unpublish(
            @PathVariable UUID entryId,
            @Valid @RequestBody ContentVersionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(scenicService.unpublish(
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
        scenicService.delete(
                entryId,
                request.expectedVersion(),
                actor,
                ApiTraceFilter.currentTraceId(servletRequest));
        return ApiResponse.of(Map.of("deleted", true));
    }
}
