package com.changqingjing.admin.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminLoginRequest(
        @NotBlank @Size(max = 100) String loginName,
        @NotBlank @Size(max = 128) String password) {
}
