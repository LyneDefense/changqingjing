package com.changqingjing.admin.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.changqingjing.config.SecurityConfig;
import com.changqingjing.common.web.ApiTraceFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AdminSystemController.class)
@Import(SecurityConfig.class)
class AdminSystemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void pingIsPublicDuringProjectBootstrap() throws Exception {
        mockMvc.perform(get("/api/v1/admin/system/ping"))
            .andExpect(status().isOk())
            .andExpect(header().exists(ApiTraceFilter.HEADER_NAME))
            .andExpect(jsonPath("$.data.service").value("admin-api"))
            .andExpect(jsonPath("$.data.status").value("ok"));
    }
}
