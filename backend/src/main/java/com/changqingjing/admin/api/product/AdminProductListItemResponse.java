package com.changqingjing.admin.api.product;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminProductListItemResponse(
        UUID id,
        String name,
        UUID coverMediaId,
        UUID categoryId,
        String categoryName,
        String status,
        int displayOrder,
        boolean hasUnpublishedChanges,
        long version,
        OffsetDateTime updatedAt) {
}
