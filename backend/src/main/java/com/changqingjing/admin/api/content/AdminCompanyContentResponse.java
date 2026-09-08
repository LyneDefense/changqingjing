package com.changqingjing.admin.api.content;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminCompanyContentResponse(
        UUID id,
        long version,
        String visibility,
        OffsetDateTime firstPublishedAt,
        OffsetDateTime updatedAt,
        AdminCompanyRevisionResponse draft,
        AdminCompanyRevisionResponse published) {

    public static AdminCompanyContentResponse empty() {
        return new AdminCompanyContentResponse(
                null, 0, "HIDDEN", null, null, null, null);
    }
}
