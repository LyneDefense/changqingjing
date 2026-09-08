package com.changqingjing.app.api.content;

import com.changqingjing.content.CompanyContentService;
import com.changqingjing.media.MediaService;

public record HomeCompanySummaryResponse(String title, String summary, String coverUrl) {

    public static HomeCompanySummaryResponse from(
            CompanyContentService.PublishedCompany company,
            MediaService mediaService) {
        return new HomeCompanySummaryResponse(
                company.revision().title(),
                company.revision().summary(),
                company.revision().coverMediaId() == null
                        ? null
                        : mediaService.signReadyMedia(company.revision().coverMediaId()).url());
    }
}
