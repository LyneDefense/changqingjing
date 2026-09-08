package com.changqingjing.admin.api.media;

import com.changqingjing.media.MediaStorage;
import java.time.OffsetDateTime;

public record MediaUploadAuthorizationResponse(
        String bucket,
        String region,
        String objectKey,
        OffsetDateTime expiresAt,
        TemporaryCredentialsResponse credentials) {

    public static MediaUploadAuthorizationResponse from(
            MediaStorage.UploadAuthorization authorization) {
        return new MediaUploadAuthorizationResponse(
                authorization.bucket(),
                authorization.region(),
                authorization.objectKey(),
                authorization.expiresAt(),
                TemporaryCredentialsResponse.from(authorization.credentials()));
    }
}
