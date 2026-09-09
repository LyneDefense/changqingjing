package com.changqingjing.admin.api.scenic;

import com.changqingjing.content.ScenicOpenStatus;
import com.changqingjing.content.ScenicPublicationStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminScenicListItemResponse(
        UUID id,
        long version,
        String title,
        UUID coverMediaId,
        ScenicPublicationStatus status,
        ScenicOpenStatus openStatus,
        int displayOrder,
        boolean hasUnpublishedChanges,
        long viewCount,
        OffsetDateTime updatedAt) {
}
