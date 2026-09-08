package com.changqingjing.common.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

class ApiLoggingPolicyTest {

    private static final String PASSWORD = "Secret-password-42";
    private static final String APP_TOKEN = "app-token-value-42";
    private static final String PHONE = "13800138000";
    private static final String LOGIN_CODE = "wechat-login-code-42";
    private static final String PHONE_CODE = "wechat-phone-code-42";

    private final Logger applicationLogger = (Logger) LoggerFactory.getLogger("com.changqingjing");
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        appender.start();
        applicationLogger.addAppender(appender);
        mockMvc = standaloneSetup(new LoggingTestController())
                .setControllerAdvice(new GlobalApiExceptionHandler())
                .addFilters(new ApiTraceFilter(), new ApiAccessLogFilter())
                .build();
    }

    @AfterEach
    void tearDown() {
        applicationLogger.detachAppender(appender);
        appender.stop();
    }

    @Test
    void excludesCredentialsAndPersonalDataFromApiLogs() throws Exception {
        String requestBody = """
                {"password":"%s","phone":"%s","phoneCode":"%s"}
                """.formatted(PASSWORD, PHONE, PHONE_CODE);

        mockMvc.perform(post("/api/v1/test/logging")
                        .queryParam("loginCode", LOGIN_CODE)
                        .header("Authorization", "Bearer " + APP_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isInternalServerError());

        List<String> messages = appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .toList();
        assertThat(messages)
                .anyMatch(message -> message.contains(
                        "route=/api/v1/test/logging, status=500"));
        assertThat(String.join("\n", messages))
                .doesNotContain(PASSWORD, APP_TOKEN, PHONE, LOGIN_CODE, PHONE_CODE);
    }

    @RestController
    @RequestMapping("/api/v1/test")
    static class LoggingTestController {

        @PostMapping("/logging")
        void fail(@RequestBody SensitiveRequest request) {
            throw new IllegalStateException(
                    "Failed request for " + request.phone() + " using " + request.password());
        }
    }

    record SensitiveRequest(String password, String phone, String phoneCode) {
    }
}
