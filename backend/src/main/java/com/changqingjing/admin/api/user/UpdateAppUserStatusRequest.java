package com.changqingjing.admin.api.user;

import com.changqingjing.app.user.AppUserStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateAppUserStatusRequest(
        @NotNull AppUserStatus status,
        @NotNull @Min(0) Long expectedVersion) {
}
