package com.changqingjing.admin.api.cooperation;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminCooperationContentResponse(
        UUID id,
        long version,
        String visibility,
        OffsetDateTime firstPublishedAt,
        OffsetDateTime updatedAt,
        AdminCooperationRevisionResponse draft,
        AdminCooperationRevisionResponse published) {

    public static AdminCooperationContentResponse empty() {
        return new AdminCooperationContentResponse(
                null, 0, "HIDDEN", null, null, null, null);
    }
}
