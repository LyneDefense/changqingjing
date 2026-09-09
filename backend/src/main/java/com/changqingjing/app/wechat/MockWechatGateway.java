package com.changqingjing.app.wechat;

import com.changqingjing.common.api.BusinessException;
import org.springframework.http.HttpStatus;

final class MockWechatGateway implements WechatGateway {

    private final String phoneNumber;

    MockWechatGateway(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    @Override
    public WechatIdentityResult exchangeLoginCode(String loginCode) {
        requireCode(loginCode, "loginCode");
        return new WechatIdentityResult("mock-app", "mock-local-user", null);
    }

    @Override
    public WechatPhoneResult exchangePhoneCode(String phoneCode) {
        requireCode(phoneCode, "phoneCode");
        return new WechatPhoneResult(phoneNumber, "mock-app");
    }

    private void requireCode(String code, String field) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "WECHAT_CODE_INVALID",
                    field + " 无效，请重新操作");
        }
    }
}
