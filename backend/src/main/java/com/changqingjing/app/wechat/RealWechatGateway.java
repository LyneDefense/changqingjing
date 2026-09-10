package com.changqingjing.app.wechat;

import com.changqingjing.common.api.BusinessException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

final class RealWechatGateway implements WechatGateway {

    private final String appId;
    private final String appSecret;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final Clock clock = Clock.systemUTC();
    private volatile AccessToken cachedAccessToken;

    RealWechatGateway(
            String appId,
            String appSecret,
            RestClient restClient,
            ObjectMapper objectMapper) {
        this.appId = appId;
        this.appSecret = appSecret;
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public WechatIdentityResult exchangeLoginCode(String loginCode) {
        try {
            String responseBody = restClient.get()
                    .uri(uri -> uri.path("/sns/jscode2session")
                            .queryParam("appid", appId)
                            .queryParam("secret", appSecret)
                            .queryParam("js_code", loginCode)
                            .queryParam("grant_type", "authorization_code")
                            .build())
                    .retrieve()
                    .body(String.class);
            CodeSessionPayload payload = parseJson(responseBody, CodeSessionPayload.class);
            if (payload == null || payload.errcode() != null || isBlank(payload.openid())) {
                throw invalidCode();
            }
            return new WechatIdentityResult(appId, payload.openid(), payload.unionid());
        } catch (BusinessException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw serviceFailure();
        }
    }

    @Override
    public WechatPhoneResult exchangePhoneCode(String phoneCode) {
        try {
            String responseBody = restClient.post()
                    .uri(uri -> uri.path("/wxa/business/getuserphonenumber")
                            .queryParam("access_token", accessToken())
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(writeJson(new PhoneRequest(phoneCode)))
                    .retrieve()
                    .body(String.class);
            PhonePayload payload = parseJson(responseBody, PhonePayload.class);
            if (payload == null || payload.errcode() != 0 || payload.phoneInfo() == null
                    || isBlank(payload.phoneInfo().phoneNumber())) {
                throw invalidCode();
            }
            String watermarkAppId = payload.phoneInfo().watermark() == null
                    ? null
                    : payload.phoneInfo().watermark().appid();
            if (!appId.equals(watermarkAppId)) {
                throw invalidCode();
            }
            return new WechatPhoneResult(payload.phoneInfo().phoneNumber(), watermarkAppId);
        } catch (BusinessException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw serviceFailure();
        }
    }

    private String accessToken() {
        AccessToken current = cachedAccessToken;
        Instant now = clock.instant();
        if (current != null && current.refreshAfter().isAfter(now)) {
            return current.value();
        }
        synchronized (this) {
            current = cachedAccessToken;
            now = clock.instant();
            if (current != null && current.refreshAfter().isAfter(now)) {
                return current.value();
            }
            String responseBody = restClient.get()
                    .uri(uri -> uri.path("/cgi-bin/token")
                            .queryParam("grant_type", "client_credential")
                            .queryParam("appid", appId)
                            .queryParam("secret", appSecret)
                            .build())
                    .retrieve()
                    .body(String.class);
            TokenPayload payload = parseJson(responseBody, TokenPayload.class);
            if (payload == null || payload.errcode() != null || isBlank(payload.accessToken())) {
                throw serviceFailure();
            }
            long refreshSeconds = Math.max(60L, payload.expiresIn() - 300L);
            cachedAccessToken = new AccessToken(
                    payload.accessToken(), now.plusSeconds(refreshSeconds));
            return cachedAccessToken.value();
        }
    }

    private BusinessException invalidCode() {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "WECHAT_CODE_INVALID",
                "微信授权凭证已失效，请重新操作");
    }

    private BusinessException serviceFailure() {
        return new BusinessException(
                HttpStatus.BAD_GATEWAY,
                "WECHAT_SERVICE_UNAVAILABLE",
                "微信服务暂时不可用，请稍后重试");
    }

    private <T> T parseJson(String responseBody, Class<T> responseType) {
        if (isBlank(responseBody)) {
            return null;
        }
        try {
            return objectMapper.readValue(responseBody, responseType);
        } catch (JsonProcessingException exception) {
            throw serviceFailure();
        }
    }

    private String writeJson(Object requestBody) {
        try {
            return objectMapper.writeValueAsString(requestBody);
        } catch (JsonProcessingException exception) {
            throw serviceFailure();
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record AccessToken(String value, Instant refreshAfter) {
    }

    private record PhoneRequest(String code) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record CodeSessionPayload(
            String openid,
            String unionid,
            @JsonProperty("errcode") Integer errcode) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TokenPayload(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("expires_in") long expiresIn,
            @JsonProperty("errcode") Integer errcode) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record PhonePayload(
            int errcode,
            @JsonProperty("phone_info") PhoneInfo phoneInfo) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record PhoneInfo(
            @JsonProperty("phoneNumber") String phoneNumber,
            Watermark watermark) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Watermark(String appid) {
    }
}
