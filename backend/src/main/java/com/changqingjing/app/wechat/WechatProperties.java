package com.changqingjing.app.wechat;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.wechat")
public class WechatProperties {

    private boolean enabled;
    private boolean mockEnabled;
    private String appId = "";
    private String appSecret = "";
    private String mockPhone = "13800138000";
    private String phoneEncryptionKeyBase64 = "";
    private Duration sessionTtl = Duration.ofDays(7);

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isMockEnabled() {
        return mockEnabled;
    }

    public void setMockEnabled(boolean mockEnabled) {
        this.mockEnabled = mockEnabled;
    }

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public String getAppSecret() {
        return appSecret;
    }

    public void setAppSecret(String appSecret) {
        this.appSecret = appSecret;
    }

    public String getMockPhone() {
        return mockPhone;
    }

    public void setMockPhone(String mockPhone) {
        this.mockPhone = mockPhone;
    }

    public String getPhoneEncryptionKeyBase64() {
        return phoneEncryptionKeyBase64;
    }

    public void setPhoneEncryptionKeyBase64(String phoneEncryptionKeyBase64) {
        this.phoneEncryptionKeyBase64 = phoneEncryptionKeyBase64;
    }

    public Duration getSessionTtl() {
        return sessionTtl;
    }

    public void setSessionTtl(Duration sessionTtl) {
        this.sessionTtl = sessionTtl;
    }
}
