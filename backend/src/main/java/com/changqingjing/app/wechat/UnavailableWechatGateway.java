package com.changqingjing.app.wechat;

import com.changqingjing.common.api.BusinessException;
import org.springframework.http.HttpStatus;

final class UnavailableWechatGateway implements WechatGateway {

    @Override
    public WechatIdentityResult exchangeLoginCode(String loginCode) {
        throw unavailable();
    }

    @Override
    public WechatPhoneResult exchangePhoneCode(String phoneCode) {
        throw unavailable();
    }

    private BusinessException unavailable() {
        return new BusinessException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "WECHAT_LOGIN_NOT_CONFIGURED",
                "微信登录尚未配置，请联系管理员");
    }
}
