package com.changqingjing.admin.api.content;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminHomeVideoContentResponse(
        UUID id,
        long version,
        String visibility,
        OffsetDateTime firstPublishedAt,
        OffsetDateTime updatedAt,
        AdminHomeVideoRevisionResponse draft,
        AdminHomeVideoRevisionResponse published) {

    public static AdminHomeVideoContentResponse empty() {
        return new AdminHomeVideoContentResponse(
                null, 0, "HIDDEN", null, null, null, null);
    }
}
