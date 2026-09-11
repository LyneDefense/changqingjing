package com.changqingjing.app.user;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AppUserView(
        UUID id,
        String displayName,
        UUID avatarMediaId,
        OffsetDateTime profileOnboardingCompletedAt,
        AppUserStatus status,
        OffsetDateTime registeredAt,
        OffsetDateTime lastLoginAt,
        String maskedPhone,
        boolean phoneBound,
        boolean wechatBound) {
}
