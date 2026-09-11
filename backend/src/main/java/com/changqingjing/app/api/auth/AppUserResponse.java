package com.changqingjing.app.api.auth;

import com.changqingjing.app.user.AppUserView;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AppUserResponse(
        UUID id,
        String displayName,
        String avatarUrl,
        boolean profileSetupRequired,
        String maskedPhone,
        boolean phoneBound,
        String status,
        OffsetDateTime registeredAt,
        OffsetDateTime lastLoginAt) {

    public static AppUserResponse from(AppUserView user, String avatarUrl) {
        return new AppUserResponse(
                user.id(),
                user.displayName(),
                avatarUrl,
                user.profileOnboardingCompletedAt() == null,
                user.maskedPhone(),
                user.phoneBound(),
                user.status().name(),
                user.registeredAt(),
                user.lastLoginAt());
    }
}
