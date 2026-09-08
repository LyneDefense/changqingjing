package com.changqingjing.admin.api.media;

public record CreateMediaUploadResponse(
        AdminMediaResponse media,
        MediaUploadAuthorizationResponse upload) {
}
