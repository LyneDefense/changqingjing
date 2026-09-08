package com.changqingjing.app.api.content;

import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.content.CompanyContentService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app")
public class AppContentController {

    private final CompanyContentService companyContentService;

    public AppContentController(CompanyContentService companyContentService) {
        this.companyContentService = companyContentService;
    }

    @GetMapping("/home")
    public ApiResponse<AppHomeResponse> home() {
        HomeCompanySummaryResponse company = companyContentService.getPublished()
                .map(HomeCompanySummaryResponse::from)
                .orElse(null);
        return ApiResponse.of(new AppHomeResponse(null, company, List.of()));
    }

    @GetMapping("/company")
    public ApiResponse<AppCompanyResponse> company() {
        return companyContentService.getPublished()
                .map(AppCompanyResponse::from)
                .map(ApiResponse::of)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "CONTENT_NOT_AVAILABLE",
                        "公司介绍暂不可查看"));
    }
}
