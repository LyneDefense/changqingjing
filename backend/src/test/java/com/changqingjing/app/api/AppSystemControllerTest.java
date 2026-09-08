package com.changqingjing.app.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import com.changqingjing.config.SecurityConfig;
import com.changqingjing.common.web.ApiTraceFilter;

@WebMvcTest(AppSystemController.class)
@Import(SecurityConfig.class)
class AppSystemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void pingIsPublic() throws Exception {
        mockMvc.perform(get("/api/v1/app/system/ping"))
            .andExpect(status().isOk())
            .andExpect(header().exists(ApiTraceFilter.HEADER_NAME))
            .andExpect(jsonPath("$.data.service").value("app-api"))
            .andExpect(jsonPath("$.data.status").value("ok"));
    }

    @Test
    void unmatchedPathsAreDenied() throws Exception {
        mockMvc.perform(get("/internal/openapi"))
            .andExpect(status().isForbidden());
    }
}
