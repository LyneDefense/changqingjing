package com.changqingjing.admin.api.media;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import com.changqingjing.media.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/media")
public class AdminMediaController {

    private final MediaService mediaService;

    public AdminMediaController(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    @PostMapping("/uploads")
    public ApiResponse<CreateMediaUploadResponse> createUpload(
            @Valid @RequestBody CreateMediaUploadRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(mediaService.createUpload(
                request,
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/uploads/{id}/complete")
    public ApiResponse<AdminMediaResponse> completeUpload(
            @PathVariable UUID id,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(mediaService.completeUpload(
                id,
                actor,
                ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminMediaResponse> get(@PathVariable UUID id) {
        return ApiResponse.of(mediaService.getAdminMedia(id));
    }
}
