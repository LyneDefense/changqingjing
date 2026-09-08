package com.changqingjing.admin.api.staff;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetAdminPasswordRequest(
        @NotBlank @Size(max = 128) String newPassword,
        @Min(0) long expectedVersion) {
}
