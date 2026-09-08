package com.changqingjing.common.web;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageQuery;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.config.ApiJacksonConfig;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

class ApiConventionTest {

    private static final String UUID_PATTERN =
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        Jackson2ObjectMapperBuilder objectMapperBuilder = Jackson2ObjectMapperBuilder.json();
        new ApiJacksonConfig().apiJacksonCustomizer().customize(objectMapperBuilder);
        mockMvc = standaloneSetup(new ConventionController())
                .setControllerAdvice(new GlobalApiExceptionHandler())
                .setValidator(validator)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(
                        objectMapperBuilder.build()))
                .addFilters(new ApiTraceFilter())
                .build();
    }

    @Test
    void usesStablePaginationDefaults() throws Exception {
        mockMvc.perform(get("/api/v1/test/conventions/page"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0]").value("first"))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(20))
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void rejectsOversizedPages() throws Exception {
        mockMvc.perform(get("/api/v1/test/conventions/page?pageSize=101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.violations[0].field").value("pageSize"));
    }

    @Test
    void serializesUuidAndOffsetTimeAsStrings() throws Exception {
        mockMvc.perform(get("/api/v1/test/conventions/types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id", matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.data.createdAt").value("2026-09-08T11:30:00Z"));
    }

    @RestController
    @RequestMapping("/api/v1/test/conventions")
    static class ConventionController {

        @GetMapping("/page")
        ApiResponse<PageResponse<String>> page(@Valid PageQuery query) {
            return ApiResponse.of(PageResponse.of(List.of("first"), query, 1));
        }

        @GetMapping("/types")
        ApiResponse<ConventionTypes> types() {
            return ApiResponse.of(new ConventionTypes(
                    UUID.fromString("53f73433-d59f-4b9e-b8aa-06be49088714"),
                    OffsetDateTime.parse("2026-09-08T11:30:00Z")));
        }
    }

    record ConventionTypes(UUID id, OffsetDateTime createdAt) {
    }
}
