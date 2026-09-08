package com.changqingjing.app.api.content;

import com.changqingjing.content.CompanyContentService;

public record HomeCompanySummaryResponse(String title, String summary) {

    public static HomeCompanySummaryResponse from(
            CompanyContentService.PublishedCompany company) {
        return new HomeCompanySummaryResponse(
                company.revision().title(),
                company.revision().summary());
    }
}
