package com.changqingjing.admin.api.staff;

import com.changqingjing.admin.auth.AdminRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateAdminStaffRequest(
        @NotBlank
        @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._-]{2,99}")
        String loginName,
        @NotBlank @Size(max = 100) String displayName,
        @NotNull AdminRole role,
        @NotBlank @Size(max = 128) String initialPassword) {
}
