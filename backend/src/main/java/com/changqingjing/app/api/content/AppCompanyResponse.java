package com.changqingjing.app.api.content;

import com.changqingjing.content.CompanyContentBlock;
import com.changqingjing.content.CompanyContentService;
import java.time.OffsetDateTime;
import java.util.List;

public record AppCompanyResponse(
        String title,
        String summary,
        List<CompanyContentBlock> blocks,
        OffsetDateTime firstPublishedAt) {

    public static AppCompanyResponse from(CompanyContentService.PublishedCompany company) {
        return new AppCompanyResponse(
                company.revision().title(),
                company.revision().summary(),
                company.revision().blocks(),
                company.firstPublishedAt());
    }
}
