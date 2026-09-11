package com.changqingjing.media;

public enum MediaPurpose {
    COMPANY_IMAGE(MediaType.IMAGE),
    COMPANY_COVER(MediaType.IMAGE),
    HOME_HERO(MediaType.IMAGE),
    HOME_VIDEO(MediaType.VIDEO),
    HOME_VIDEO_COVER(MediaType.IMAGE),
    SCENIC_IMAGE(MediaType.IMAGE),
    PRODUCT_IMAGE(MediaType.IMAGE),
    COOPERATION_IMAGE(MediaType.IMAGE),
    APP_USER_AVATAR(MediaType.IMAGE);

    private final MediaType mediaType;

    MediaPurpose(MediaType mediaType) {
        this.mediaType = mediaType;
    }

    public MediaType mediaType() {
        return mediaType;
    }
}
