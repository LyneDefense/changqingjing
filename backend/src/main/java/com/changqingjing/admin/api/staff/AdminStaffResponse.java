package com.changqingjing.admin.api.staff;

import com.changqingjing.admin.auth.AdminAccount;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminStaffResponse(
        UUID id,
        String loginName,
        String displayName,
        String role,
        String status,
        OffsetDateTime lastLoginAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        long version) {

    public static AdminStaffResponse from(AdminAccount account) {
        return new AdminStaffResponse(
                account.id(),
                account.loginName(),
                account.displayName(),
                account.role().name(),
                account.status().name(),
                account.lastLoginAt(),
                account.createdAt(),
                account.updatedAt(),
                account.lockVersion());
    }
}
