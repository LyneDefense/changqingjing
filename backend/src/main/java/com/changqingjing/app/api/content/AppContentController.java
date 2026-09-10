package com.changqingjing.app.api.content;

import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageQuery;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.content.CompanyContentService;
import com.changqingjing.content.HomeHeroContentService;
import com.changqingjing.content.HomeVideoContentService;
import com.changqingjing.content.ScenicContentService;
import com.changqingjing.media.MediaService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app")
public class AppContentController {

    private final CompanyContentService companyContentService;
    private final HomeHeroContentService homeHeroContentService;
    private final HomeVideoContentService homeVideoContentService;
    private final ScenicContentService scenicContentService;
    private final MediaService mediaService;

    public AppContentController(
            CompanyContentService companyContentService,
            HomeHeroContentService homeHeroContentService,
            HomeVideoContentService homeVideoContentService,
            ScenicContentService scenicContentService,
            MediaService mediaService) {
        this.companyContentService = companyContentService;
        this.homeHeroContentService = homeHeroContentService;
        this.homeVideoContentService = homeVideoContentService;
        this.scenicContentService = scenicContentService;
        this.mediaService = mediaService;
    }

    @GetMapping("/home")
    public ApiResponse<AppHomeResponse> home() {
        HomeHeroResponse hero = homeHeroContentService.getPublished()
                .map(content -> HomeHeroResponse.from(content, mediaService))
                .orElse(null);
        HomeVideoResponse video = homeVideoContentService.getPublished()
                .map(content -> HomeVideoResponse.from(content, mediaService))
                .orElse(null);
        HomeCompanySummaryResponse company = companyContentService.getPublished()
                .map(content -> HomeCompanySummaryResponse.from(content, mediaService))
                .orElse(null);
        PageQuery scenicQuery = new PageQuery();
        scenicQuery.setPageSize(1);
        var scenics = scenicContentService.getPublished(scenicQuery).items().stream()
                .map(content -> AppScenicSummaryResponse.from(content, mediaService).toHomeSummary())
                .toList();
        return ApiResponse.of(new AppHomeResponse(hero, video, company, scenics));
    }

    @GetMapping("/company")
    public ApiResponse<AppCompanyResponse> company() {
        return companyContentService.getPublished()
                .map(content -> AppCompanyResponse.from(content, mediaService))
                .map(ApiResponse::of)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "CONTENT_NOT_AVAILABLE",
                        "公司介绍暂不可查看"));
    }

    @GetMapping("/scenics")
    public ApiResponse<PageResponse<AppScenicSummaryResponse>> scenics(
            @Valid PageQuery query) {
        PageResponse<ScenicContentService.PublishedScenic> result =
                scenicContentService.getPublished(query);
        return ApiResponse.of(new PageResponse<>(
                result.items().stream()
                        .map(content -> AppScenicSummaryResponse.from(content, mediaService))
                        .toList(),
                result.page(),
                result.pageSize(),
                result.total()));
    }

    @GetMapping("/scenics/{entryId}")
    public ApiResponse<AppScenicResponse> scenic(@PathVariable UUID entryId) {
        return ApiResponse.of(AppScenicResponse.from(
                scenicContentService.getPublished(entryId), mediaService));
    }

    @PostMapping("/scenics/{entryId}/views")
    public ApiResponse<ScenicViewResponse> recordScenicView(
            @PathVariable UUID entryId,
            @Valid @RequestBody RecordScenicViewRequest request) {
        return ApiResponse.of(new ScenicViewResponse(
                scenicContentService.recordView(entryId, request.viewId())));
    }
}
