package com.changqingjing.admin.auth;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminAccount(
        UUID id,
        String loginName,
        String loginNameNormalized,
        String passwordHash,
        String displayName,
        AdminRole role,
        AdminStatus status,
        OffsetDateTime passwordChangedAt,
        OffsetDateTime lastLoginAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        long lockVersion) {
}
