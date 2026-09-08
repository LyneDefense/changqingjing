package com.changqingjing.app.api.content;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.config.SecurityConfig;
import com.changqingjing.content.CompanyBlockType;
import com.changqingjing.content.CompanyContentBlock;
import com.changqingjing.content.CompanyContentRepository;
import com.changqingjing.content.CompanyContentService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AppContentController.class)
@Import(SecurityConfig.class)
class AppContentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminAccountRepository adminAccountRepository;

    @MockBean
    private CompanyContentService companyContentService;

    @Test
    void homeIsPublicAndOmitsAnUnpublishedCompany() throws Exception {
        when(companyContentService.getPublished()).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/app/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.company").doesNotExist())
                .andExpect(jsonPath("$.data.scenics").isEmpty());

        mockMvc.perform(get("/api/v1/app/company"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CONTENT_NOT_AVAILABLE"));
    }

    @Test
    void companyReturnsOnlyThePublishedDocument() throws Exception {
        when(companyContentService.getPublished()).thenReturn(Optional.of(publishedCompany()));

        mockMvc.perform(get("/api/v1/app/company"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("公司介绍"))
                .andExpect(jsonPath("$.data.blocks[0].type").value("PARAGRAPH"));
    }

    private CompanyContentService.PublishedCompany publishedCompany() {
        OffsetDateTime publishedAt = OffsetDateTime.parse("2026-09-08T08:00:00Z");
        return new CompanyContentService.PublishedCompany(
                new CompanyContentRepository.Revision(
                        UUID.randomUUID(),
                        1,
                        "公司介绍",
                        "公司简介",
                        List.of(new CompanyContentBlock(
                                CompanyBlockType.PARAGRAPH,
                                "公司详情正文")),
                        UUID.randomUUID(),
                        publishedAt),
                publishedAt);
    }
}
