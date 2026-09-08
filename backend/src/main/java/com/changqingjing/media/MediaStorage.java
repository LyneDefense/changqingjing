package com.changqingjing.media;

import java.time.Duration;
import java.time.OffsetDateTime;

public interface MediaStorage {

    UploadAuthorization authorizeUpload(
            String objectKey,
            String contentType,
            Duration validity);

    StoredObject inspect(String objectKey);

    SignedObjectUrl signRead(String objectKey, Duration validity);

    void delete(String objectKey);

    record UploadAuthorization(
            String bucket,
            String region,
            String objectKey,
            OffsetDateTime expiresAt,
            TemporaryCredentials credentials) {
    }

    record TemporaryCredentials(
            String secretId,
            String secretKey,
            String sessionToken,
            long startTime,
            long expiredTime) {
    }

    record StoredObject(
            long sizeBytes,
            String contentType,
            String etag,
            byte[] header) {

        public StoredObject {
            header = header.clone();
        }

        @Override
        public byte[] header() {
            return header.clone();
        }
    }

    record SignedObjectUrl(String url, OffsetDateTime expiresAt) {
    }
}
