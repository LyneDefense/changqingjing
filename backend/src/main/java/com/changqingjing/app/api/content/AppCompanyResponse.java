package com.changqingjing.app.api.content;

import com.changqingjing.content.CompanyContentService;
import com.changqingjing.media.MediaService;
import java.time.OffsetDateTime;
import java.util.List;

public record AppCompanyResponse(
        String title,
        String summary,
        String coverUrl,
        List<String> galleryUrls,
        List<AppCompanyBlockResponse> blocks,
        OffsetDateTime firstPublishedAt) {

    public static AppCompanyResponse from(
            CompanyContentService.PublishedCompany company,
            MediaService mediaService) {
        String coverUrl = company.revision().coverMediaId() == null
                ? null
                : mediaService.signReadyMedia(company.revision().coverMediaId()).url();
        return new AppCompanyResponse(
                company.revision().title(),
                company.revision().summary(),
                coverUrl,
                company.revision().galleryMediaIds().stream()
                        .map(mediaId -> mediaService.signReadyMedia(mediaId).url())
                        .toList(),
                company.revision().blocks().stream()
                        .map(block -> AppCompanyBlockResponse.from(block, mediaService))
                        .toList(),
                company.firstPublishedAt());
    }
}
