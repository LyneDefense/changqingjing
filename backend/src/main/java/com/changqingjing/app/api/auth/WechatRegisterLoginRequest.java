package com.changqingjing.app.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WechatRegisterLoginRequest(
        @NotBlank(message = "微信登录凭证不能为空")
        @Size(max = 256, message = "微信登录凭证过长")
        String loginCode,
        @NotBlank(message = "手机号授权凭证不能为空")
        @Size(max = 256, message = "手机号授权凭证过长")
        String phoneCode) {
}
