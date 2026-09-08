package com.changqingjing.common.web;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

class ApiErrorHandlingTest {

    private static final String UUID_PATTERN =
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalApiExceptionHandler())
                .addFilters(new ApiTraceFilter())
                .build();
    }

    @Test
    void addsTraceIdToSuccessfulApiResponse() throws Exception {
        mockMvc.perform(get("/api/v1/test/success"))
                .andExpect(status().isOk())
                .andExpect(header().string(ApiTraceFilter.HEADER_NAME, matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.data").value("ok"));
    }

    @Test
    void returnsFieldViolationsForInvalidBody() throws Exception {
        mockMvc.perform(post("/api/v1/test/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string(ApiTraceFilter.HEADER_NAME, matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value("请求参数校验失败"))
                .andExpect(jsonPath("$.traceId", matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.violations[0].field").value("name"));
    }

    @Test
    void returnsStableBusinessError() throws Exception {
        mockMvc.perform(get("/api/v1/test/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONTENT_VERSION_CONFLICT"))
                .andExpect(jsonPath("$.message").value("内容已被其他人修改"))
                .andExpect(jsonPath("$.traceId", matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.violations").doesNotExist());
    }

    @Test
    void hidesUnexpectedExceptionDetails() throws Exception {
        mockMvc.perform(get("/api/v1/test/error"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("服务暂时不可用"))
                .andExpect(jsonPath("$.traceId", matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.detail").doesNotExist());
    }

    @RestController
    @RequestMapping("/api/v1/test")
    static class TestController {

        @GetMapping("/success")
        ApiResponse<String> success() {
            return ApiResponse.of("ok");
        }

        @PostMapping("/validate")
        ApiResponse<String> validate(@Valid @RequestBody TestRequest request) {
            return ApiResponse.of(request.name());
        }

        @GetMapping("/conflict")
        void conflict() {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "CONTENT_VERSION_CONFLICT",
                    "内容已被其他人修改");
        }

        @GetMapping("/error")
        void error() {
            throw new IllegalStateException("database credentials must stay private");
        }
    }

    record TestRequest(@NotBlank String name) {
    }
}
