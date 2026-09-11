package com.changqingjing.media;

import java.io.InputStream;
import java.time.Duration;

final class UnavailableMediaStorage implements MediaStorage {

    private MediaStorageException unavailable() {
        return new MediaStorageException(
                "MEDIA_STORAGE_NOT_CONFIGURED",
                "媒体存储尚未配置");
    }

    @Override
    public UploadAuthorization authorizeUpload(
            String objectKey,
            String contentType,
            Duration validity) {
        throw unavailable();
    }

    @Override
    public StoredObject inspect(String objectKey) {
        throw unavailable();
    }

    @Override
    public void store(
            String objectKey,
            String contentType,
            long sizeBytes,
            InputStream inputStream) {
        throw unavailable();
    }

    @Override
    public SignedObjectUrl signRead(String objectKey, Duration validity) {
        throw unavailable();
    }

    @Override
    public void delete(String objectKey) {
        throw unavailable();
    }
}
