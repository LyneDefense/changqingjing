package com.changqingjing.app.api.content;

import com.changqingjing.content.ScenicContentService;
import com.changqingjing.content.ScenicOpenStatus;
import com.changqingjing.media.MediaService;
import java.util.UUID;

public record AppScenicSummaryResponse(
        UUID id,
        String title,
        String summary,
        String coverUrl,
        ScenicOpenStatus openStatus,
        int displayOrder) {

    public static AppScenicSummaryResponse from(
            ScenicContentService.PublishedScenic scenic,
            MediaService mediaService) {
        var revision = scenic.revision();
        return new AppScenicSummaryResponse(
                scenic.id(),
                revision.title(),
                revision.summary(),
                mediaService.signReadyMedia(revision.coverMediaId()).url(),
                revision.openStatus(),
                revision.displayOrder());
    }

    public HomeScenicSummaryResponse toHomeSummary() {
        return new HomeScenicSummaryResponse(id, title, summary, coverUrl, displayOrder);
    }
}
