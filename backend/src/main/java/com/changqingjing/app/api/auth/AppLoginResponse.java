package com.changqingjing.app.api.auth;

import java.time.OffsetDateTime;

public record AppLoginResponse(
        String accessToken,
        OffsetDateTime expiresAt,
        AppUserResponse user) {
}
