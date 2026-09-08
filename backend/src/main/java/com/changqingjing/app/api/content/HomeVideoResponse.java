package com.changqingjing.app.api.content;

import com.changqingjing.content.HomeVideoContentService;
import com.changqingjing.media.MediaService;

public record HomeVideoResponse(String title, String coverUrl, String playbackUrl) {

    public static HomeVideoResponse from(
            HomeVideoContentService.PublishedHomeVideo video,
            MediaService mediaService) {
        return new HomeVideoResponse(
                video.revision().title(),
                mediaService.signReadyMedia(video.revision().coverMediaId()).url(),
                mediaService.signReadyMedia(video.revision().videoMediaId()).url());
    }
}
