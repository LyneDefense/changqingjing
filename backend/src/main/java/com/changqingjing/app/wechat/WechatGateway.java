package com.changqingjing.app.wechat;

public interface WechatGateway {

    WechatIdentityResult exchangeLoginCode(String loginCode);

    WechatPhoneResult exchangePhoneCode(String phoneCode);
}
