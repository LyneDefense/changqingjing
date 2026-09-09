package com.changqingjing.admin.api.content;

import com.changqingjing.content.HomeVideoStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminHomeVideoListItemResponse(
        UUID id,
        long version,
        String title,
        UUID coverMediaId,
        HomeVideoStatus status,
        boolean hasUnpublishedChanges,
        OffsetDateTime firstPublishedAt,
        OffsetDateTime updatedAt) {
}
