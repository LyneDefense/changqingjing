package com.changqingjing.admin.api.content;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminHomeHeroContentResponse(
        UUID id,
        long version,
        String visibility,
        OffsetDateTime firstPublishedAt,
        OffsetDateTime updatedAt,
        AdminHomeHeroRevisionResponse draft,
        AdminHomeHeroRevisionResponse published) {

    public static AdminHomeHeroContentResponse empty() {
        return new AdminHomeHeroContentResponse(null, 0, "HIDDEN", null, null, null, null);
    }
}
