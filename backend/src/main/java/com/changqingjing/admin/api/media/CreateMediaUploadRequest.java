package com.changqingjing.admin.api.media;

import com.changqingjing.media.MediaPurpose;
import com.changqingjing.media.MediaType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateMediaUploadRequest(
        @NotBlank @Size(max = 255) String originalFilename,
        @NotNull MediaType mediaType,
        @NotBlank @Size(max = 255) String contentType,
        @Positive long sizeBytes,
        @NotNull MediaPurpose purpose) {
}
