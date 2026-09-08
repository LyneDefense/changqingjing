package com.changqingjing.admin.api.media;

import com.changqingjing.media.MediaAssetRepository;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminMediaResponse(
        UUID id,
        String originalFilename,
        String mediaType,
        String contentType,
        long sizeBytes,
        String status,
        String purpose,
        String failureCode,
        int verificationAttempts,
        OffsetDateTime createdAt,
        OffsetDateTime verifiedAt,
        String previewUrl,
        OffsetDateTime previewExpiresAt) {

    public static AdminMediaResponse from(
            MediaAssetRepository.Asset asset,
            String previewUrl,
            OffsetDateTime previewExpiresAt) {
        return new AdminMediaResponse(
                asset.id(),
                asset.originalFilename(),
                asset.mediaType().name(),
                asset.contentType(),
                asset.sizeBytes(),
                asset.status().name(),
                asset.purpose().name(),
                asset.failureCode(),
                asset.verificationAttempts(),
                asset.createdAt(),
                asset.verifiedAt(),
                previewUrl,
                previewExpiresAt);
    }
}
