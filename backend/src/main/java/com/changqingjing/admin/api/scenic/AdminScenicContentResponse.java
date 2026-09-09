package com.changqingjing.admin.api.scenic;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminScenicContentResponse(
        UUID id,
        long version,
        String visibility,
        OffsetDateTime firstPublishedAt,
        OffsetDateTime updatedAt,
        AdminScenicRevisionResponse draft,
        AdminScenicRevisionResponse published) {
}
