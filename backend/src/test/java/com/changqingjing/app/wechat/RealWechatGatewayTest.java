package com.changqingjing.app.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.changqingjing.common.api.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class RealWechatGatewayTest {

    private MockRestServiceServer server;
    private RealWechatGateway gateway;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://api.weixin.qq.com");
        server = MockRestServiceServer.bindTo(builder).build();
        gateway = new RealWechatGateway(
                "test-app-id",
                "test-app-secret",
                builder.build(),
                new ObjectMapper());
    }

    @Test
    void readsCodeSessionJsonReturnedAsPlainText() {
        server.expect(requestTo("https://api.weixin.qq.com/sns/jscode2session"
                        + "?appid=test-app-id&secret=test-app-secret&js_code=login-code"
                        + "&grant_type=authorization_code"))
                .andRespond(withSuccess("""
                        {"openid":"openid-1","unionid":"unionid-1","session_key":"ignored"}
                        """, MediaType.TEXT_PLAIN));

        WechatIdentityResult result = gateway.exchangeLoginCode("login-code");

        assertThat(result.appId()).isEqualTo("test-app-id");
        assertThat(result.openid()).isEqualTo("openid-1");
        assertThat(result.unionid()).isEqualTo("unionid-1");
        server.verify();
    }

    @Test
    void mapsWechatErrorJsonReturnedAsPlainText() {
        server.expect(requestTo("https://api.weixin.qq.com/sns/jscode2session"
                        + "?appid=test-app-id&secret=test-app-secret&js_code=invalid-code"
                        + "&grant_type=authorization_code"))
                .andRespond(withSuccess("""
                        {"errcode":40029,"errmsg":"invalid code"}
                        """, MediaType.TEXT_PLAIN));

        assertThatThrownBy(() -> gateway.exchangeLoginCode("invalid-code"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("WECHAT_CODE_INVALID");
        server.verify();
    }

    @Test
    void readsAccessTokenAndPhoneJsonReturnedAsPlainText() {
        server.expect(requestTo("https://api.weixin.qq.com/cgi-bin/token"
                        + "?grant_type=client_credential&appid=test-app-id"
                        + "&secret=test-app-secret"))
                .andRespond(withSuccess("""
                        {"access_token":"access-token","expires_in":7200}
                        """, MediaType.TEXT_PLAIN));
        server.expect(requestTo("https://api.weixin.qq.com/wxa/business/getuserphonenumber"
                        + "?access_token=access-token"))
                .andRespond(withSuccess("""
                        {
                          "errcode": 0,
                          "errmsg": "ok",
                          "phone_info": {
                            "phoneNumber": "13800138000",
                            "purePhoneNumber": "13800138000",
                            "countryCode": "86",
                            "watermark": {"timestamp": 1660000000, "appid": "test-app-id"}
                          }
                        }
                        """, MediaType.TEXT_PLAIN));

        WechatPhoneResult result = gateway.exchangePhoneCode("phone-code");

        assertThat(result.phoneNumber()).isEqualTo("13800138000");
        assertThat(result.appId()).isEqualTo("test-app-id");
        server.verify();
    }
}
