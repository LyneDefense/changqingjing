package com.changqingjing.app.user;

import com.changqingjing.app.api.auth.AppLoginResponse;
import com.changqingjing.app.wechat.WechatGateway;
import com.changqingjing.app.wechat.WechatIdentityResult;
import com.changqingjing.app.wechat.WechatPhoneResult;
import org.springframework.stereotype.Service;

@Service
public class AppLoginService {

    private final WechatGateway wechatGateway;
    private final AppRegistrationService registrationService;

    public AppLoginService(
            WechatGateway wechatGateway,
            AppRegistrationService registrationService) {
        this.wechatGateway = wechatGateway;
        this.registrationService = registrationService;
    }

    public AppLoginResponse restore(String loginCode) {
        WechatIdentityResult identity = wechatGateway.exchangeLoginCode(loginCode);
        return registrationService.restore(identity);
    }

    public AppLoginResponse registerLogin(String loginCode, String phoneCode) {
        WechatIdentityResult identity = wechatGateway.exchangeLoginCode(loginCode);
        WechatPhoneResult phone = wechatGateway.exchangePhoneCode(phoneCode);
        return registrationService.register(identity, phone);
    }
}
