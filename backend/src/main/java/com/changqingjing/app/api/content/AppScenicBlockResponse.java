package com.changqingjing.app.api.content;

import com.changqingjing.content.CompanyBlockType;
import com.changqingjing.content.ScenicContentBlock;
import com.changqingjing.media.MediaService;

public record AppScenicBlockResponse(
        CompanyBlockType type,
        String text,
        String imageUrl,
        String altText) {

    public static AppScenicBlockResponse from(
            ScenicContentBlock block,
            MediaService mediaService) {
        String imageUrl = block.mediaId() == null
                ? null
                : mediaService.signReadyMedia(block.mediaId()).url();
        return new AppScenicBlockResponse(
                block.type(), block.text(), imageUrl, block.altText());
    }
}
