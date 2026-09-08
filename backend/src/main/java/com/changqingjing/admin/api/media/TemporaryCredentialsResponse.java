package com.changqingjing.admin.api.media;

import com.changqingjing.media.MediaStorage;

public record TemporaryCredentialsResponse(
        String secretId,
        String secretKey,
        String sessionToken,
        long startTime,
        long expiredTime) {

    public static TemporaryCredentialsResponse from(
            MediaStorage.TemporaryCredentials credentials) {
        return new TemporaryCredentialsResponse(
                credentials.secretId(),
                credentials.secretKey(),
                credentials.sessionToken(),
                credentials.startTime(),
                credentials.expiredTime());
    }
}
