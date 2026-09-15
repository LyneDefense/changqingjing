package com.changqingjing.admin.api.user;

import com.changqingjing.app.user.AppUserView;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminAppUserResponse(
        UUID id,
        String displayName,
        String maskedPhone,
        boolean phoneBound,
        boolean wechatBound,
        String status,
        OffsetDateTime registeredAt,
        OffsetDateTime lastLoginAt,
        long version) {

    public static AdminAppUserResponse from(AppUserView user) {
        return new AdminAppUserResponse(
                user.id(),
                user.displayName(),
                user.maskedPhone(),
                user.phoneBound(),
                user.wechatBound(),
                user.status().name(),
                user.registeredAt(),
                user.lastLoginAt(),
                user.lockVersion());
    }
}
