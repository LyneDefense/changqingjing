package com.changqingjing.app.api.profile;

import jakarta.validation.constraints.Size;

public record UpdateAppProfileRequest(
        @Size(max = 30, message = "昵称不能超过30个字符") String displayName) {
}
