package com.changqingjing.admin.api.product;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminProductContentResponse(
        UUID id,
        long version,
        String visibility,
        OffsetDateTime firstPublishedAt,
        OffsetDateTime updatedAt,
        AdminProductRevisionResponse draft,
        AdminProductRevisionResponse published) {
}
