package com.changqingjing.app.api.content;

import com.changqingjing.content.CompanyBlockType;
import com.changqingjing.content.CompanyContentBlock;
import com.changqingjing.media.MediaService;

public record AppCompanyBlockResponse(
        CompanyBlockType type,
        String text,
        String imageUrl,
        String altText) {

    public static AppCompanyBlockResponse from(
            CompanyContentBlock block,
            MediaService mediaService) {
        String imageUrl = block.mediaId() == null
                ? null
                : mediaService.signReadyMedia(block.mediaId()).url();
        return new AppCompanyBlockResponse(
                block.type(), block.text(), imageUrl, block.altText());
    }
}
