package com.changqingjing.admin.api.staff;

import com.changqingjing.admin.auth.AdminRole;
import com.changqingjing.admin.auth.AdminStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record UpdateAdminStaffRequest(
        @Size(min = 1, max = 100) String displayName,
        AdminRole role,
        AdminStatus status,
        @Min(0) long expectedVersion) {
}
