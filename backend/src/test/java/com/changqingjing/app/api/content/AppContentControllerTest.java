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
import com.changqingjing.content.HomeHeroContentService;
import com.changqingjing.content.HomeHeroContentRepository;
import com.changqingjing.content.HomeVideoContentService;
import com.changqingjing.content.HomeVideoContentRepository;
import com.changqingjing.content.ScenicContentService;
import com.changqingjing.content.ScenicContentRepository;
import com.changqingjing.content.ScenicOpenStatus;
import com.changqingjing.media.MediaService;
import com.changqingjing.media.MediaStorage;
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

    @MockBean
    private HomeVideoContentService homeVideoContentService;

    @MockBean
    private HomeHeroContentService homeHeroContentService;

    @MockBean
    private ScenicContentService scenicContentService;

    @MockBean
    private MediaService mediaService;

    @Test
    void homeIsPublicAndOmitsAnUnpublishedCompany() throws Exception {
        when(companyContentService.getPublished()).thenReturn(Optional.empty());
        when(scenicContentService.getPublished(
                org.mockito.ArgumentMatchers.any(com.changqingjing.common.api.PageQuery.class)))
                .thenReturn(new com.changqingjing.common.api.PageResponse<>(
                        List.of(), 1, 20, 0));

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

    @Test
    void homeReturnsShortLivedUrlsForPublishedVideo() throws Exception {
        UUID coverId = UUID.randomUUID();
        UUID videoId = UUID.randomUUID();
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-09-08T08:00:00Z");
        when(homeVideoContentService.getPublished()).thenReturn(Optional.of(
                new HomeVideoContentService.PublishedHomeVideo(
                        new HomeVideoContentRepository.Revision(
                                UUID.randomUUID(),
                                1,
                                "宣传片",
                                coverId,
                                videoId,
                                true,
                                UUID.randomUUID(),
                                createdAt))));
        when(scenicContentService.getPublished(
                org.mockito.ArgumentMatchers.any(com.changqingjing.common.api.PageQuery.class)))
                .thenReturn(new com.changqingjing.common.api.PageResponse<>(
                        List.of(), 1, 20, 0));
        when(mediaService.signReadyMedia(coverId)).thenReturn(
                new MediaStorage.SignedObjectUrl(
                        "https://media.example/cover.jpg?signature=short",
                        createdAt.plusMinutes(15)));
        when(mediaService.signReadyMedia(videoId)).thenReturn(
                new MediaStorage.SignedObjectUrl(
                        "https://media.example/video.mp4?signature=short",
                        createdAt.plusMinutes(15)));

        mockMvc.perform(get("/api/v1/app/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.video.title").value("宣传片"))
                .andExpect(jsonPath("$.data.video.coverUrl").value(
                        "https://media.example/cover.jpg?signature=short"))
                .andExpect(jsonPath("$.data.video.playbackUrl").value(
                        "https://media.example/video.mp4?signature=short"));
    }

    @Test
    void homeReturnsPublishedHeroAndRequestsOnlyOneScenic() throws Exception {
        UUID coverId = UUID.randomUUID();
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-09-08T08:00:00Z");
        when(homeHeroContentService.getPublished()).thenReturn(Optional.of(
                new HomeHeroContentService.PublishedHomeHero(
                        new HomeHeroContentRepository.Revision(
                                UUID.randomUUID(), 1, coverId, UUID.randomUUID(), createdAt))));
        when(scenicContentService.getPublished(
                org.mockito.ArgumentMatchers.argThat(
                        (com.changqingjing.common.api.PageQuery query) ->
                                query.getPageSize() == 1)))
                .thenReturn(new com.changqingjing.common.api.PageResponse<>(
                        List.of(), 1, 1, 0));
        when(mediaService.signReadyMedia(coverId)).thenReturn(
                new MediaStorage.SignedObjectUrl(
                        "https://media.example/hero.jpg?signature=short",
                        createdAt.plusMinutes(15)));

        mockMvc.perform(get("/api/v1/app/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hero.coverUrl").value(
                        "https://media.example/hero.jpg?signature=short"))
                .andExpect(jsonPath("$.data.hero.title").doesNotExist())
                .andExpect(jsonPath("$.data.hero.focusX").doesNotExist());
    }

    @Test
    void scenicWithoutNavigationLocationRemainsPublic() throws Exception {
        UUID scenicId = UUID.randomUUID();
        UUID coverId = UUID.randomUUID();
        OffsetDateTime publishedAt = OffsetDateTime.parse("2026-09-08T08:00:00Z");
        when(scenicContentService.getPublished(scenicId)).thenReturn(
                new ScenicContentService.PublishedScenic(
                        scenicId,
                        new ScenicContentRepository.Revision(
                                UUID.randomUUID(),
                                1,
                                "仙岛湖旅游风景区",
                                "千岛星布，水天相映",
                                coverId,
                                List.of(new com.changqingjing.content.ScenicContentBlock(
                                        CompanyBlockType.PARAGRAPH,
                                        "景区介绍",
                                        null,
                                        null)),
                                ScenicOpenStatus.OPEN,
                                0,
                                null,
                                UUID.randomUUID(),
                                publishedAt),
                        publishedAt,
                        3));
        when(mediaService.signReadyMedia(coverId)).thenReturn(
                new MediaStorage.SignedObjectUrl(
                        "https://media.example/scenic.jpg?signature=short",
                        publishedAt.plusMinutes(15)));

        mockMvc.perform(get("/api/v1/app/scenics/{entryId}", scenicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("仙岛湖旅游风景区"))
                .andExpect(jsonPath("$.data.displayName").doesNotExist())
                .andExpect(jsonPath("$.data.longitude").doesNotExist());
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
