package com.changqingjing.app.api.content;

import com.changqingjing.content.ScenicContentService;
import com.changqingjing.content.ScenicLocation;
import com.changqingjing.content.ScenicOpenStatus;
import com.changqingjing.media.MediaService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AppScenicResponse(
        UUID id,
        String title,
        String summary,
        String coverUrl,
        List<AppScenicBlockResponse> blocks,
        ScenicOpenStatus openStatus,
        String displayName,
        String address,
        BigDecimal longitude,
        BigDecimal latitude,
        String coordinateSystem,
        OffsetDateTime firstPublishedAt,
        long viewCount) {

    public static AppScenicResponse from(
            ScenicContentService.PublishedScenic scenic,
            MediaService mediaService) {
        var revision = scenic.revision();
        ScenicLocation location = revision.location();
        return new AppScenicResponse(
                scenic.id(),
                revision.title(),
                revision.summary(),
                mediaService.signReadyMedia(revision.coverMediaId()).url(),
                revision.blocks().stream()
                        .map(block -> AppScenicBlockResponse.from(block, mediaService))
                        .toList(),
                revision.openStatus(),
                location == null ? null : location.displayName(),
                location == null ? null : location.providerAddress(),
                location == null ? null : location.longitude(),
                location == null ? null : location.latitude(),
                location == null ? null : location.coordinateSystem(),
                scenic.firstPublishedAt(),
                scenic.viewCount());
    }
}
