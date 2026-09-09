package com.changqingjing.app.api.auth;

import com.changqingjing.app.user.AppUserView;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AppUserResponse(
        UUID id,
        String displayName,
        String maskedPhone,
        boolean phoneBound,
        String status,
        OffsetDateTime registeredAt,
        OffsetDateTime lastLoginAt) {

    public static AppUserResponse from(AppUserView user) {
        return new AppUserResponse(
                user.id(),
                user.displayName(),
                user.maskedPhone(),
                user.phoneBound(),
                user.status().name(),
                user.registeredAt(),
                user.lastLoginAt());
    }
}
