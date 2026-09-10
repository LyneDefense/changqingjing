package com.changqingjing.app.wechat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Arrays;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.EnvironmentAware;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(WechatProperties.class)
public class WechatConfiguration implements EnvironmentAware {

    private Environment environment;

    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
    }

    @Bean
    WechatGateway wechatGateway(WechatProperties properties, ObjectMapper objectMapper) {
        validate(properties);
        if (properties.isMockEnabled()) {
            return new MockWechatGateway(properties.getMockPhone());
        }
        if (!properties.isEnabled()) {
            return new UnavailableWechatGateway();
        }
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(8));
        RestClient restClient = RestClient.builder()
                .baseUrl("https://api.weixin.qq.com")
                .requestFactory(requestFactory)
                .build();
        return new RealWechatGateway(
                properties.getAppId().strip(),
                properties.getAppSecret().strip(),
                restClient,
                objectMapper);
    }

    private void validate(WechatProperties properties) {
        boolean production = environment.acceptsProfiles(Profiles.of("prod"));
        if (production && properties.isMockEnabled()) {
            throw new IllegalStateException("Production must not enable mock WeChat login");
        }
        if (production && !properties.isEnabled()) {
            throw new IllegalStateException("Production must enable WeChat login");
        }
        if (properties.isEnabled()
                && (!StringUtils.hasText(properties.getAppId())
                    || !StringUtils.hasText(properties.getAppSecret()))) {
            throw new IllegalStateException("Enabled WeChat login requires AppID and AppSecret");
        }
        if ((production || properties.isEnabled() || properties.isMockEnabled())
                && !StringUtils.hasText(properties.getPhoneEncryptionKeyBase64())) {
            throw new IllegalStateException("WeChat login requires a phone encryption key");
        }
        if (properties.getSessionTtl() == null
                || properties.getSessionTtl().isNegative()
                || properties.getSessionTtl().isZero()) {
            throw new IllegalStateException("App session TTL must be positive");
        }
        if (properties.isMockEnabled()
                && !Arrays.asList(environment.getActiveProfiles()).contains("local")) {
            throw new IllegalStateException("Mock WeChat login is only allowed in the local profile");
        }
    }
}
