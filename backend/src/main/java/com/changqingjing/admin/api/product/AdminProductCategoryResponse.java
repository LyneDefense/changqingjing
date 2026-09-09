package com.changqingjing.admin.api.product;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminProductCategoryResponse(
        UUID id,
        String name,
        int displayOrder,
        String status,
        boolean hasUnpublishedChanges,
        long version,
        OffsetDateTime updatedAt) {
}
