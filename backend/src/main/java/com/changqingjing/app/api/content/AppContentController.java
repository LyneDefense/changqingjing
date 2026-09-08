package com.changqingjing.app.api.content;

import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.content.CompanyContentService;
import com.changqingjing.content.HomeVideoContentService;
import com.changqingjing.media.MediaService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app")
public class AppContentController {

    private final CompanyContentService companyContentService;
    private final HomeVideoContentService homeVideoContentService;
    private final MediaService mediaService;

    public AppContentController(
            CompanyContentService companyContentService,
            HomeVideoContentService homeVideoContentService,
            MediaService mediaService) {
        this.companyContentService = companyContentService;
        this.homeVideoContentService = homeVideoContentService;
        this.mediaService = mediaService;
    }

    @GetMapping("/home")
    public ApiResponse<AppHomeResponse> home() {
        HomeVideoResponse video = homeVideoContentService.getPublished()
                .map(content -> HomeVideoResponse.from(content, mediaService))
                .orElse(null);
        HomeCompanySummaryResponse company = companyContentService.getPublished()
                .map(content -> HomeCompanySummaryResponse.from(content, mediaService))
                .orElse(null);
        return ApiResponse.of(new AppHomeResponse(video, company, List.of()));
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
}
