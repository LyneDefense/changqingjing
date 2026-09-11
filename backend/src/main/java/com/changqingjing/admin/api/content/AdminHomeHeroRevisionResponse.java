package com.changqingjing.admin.api.content;

import com.changqingjing.content.HomeHeroContentRepository;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminHomeHeroRevisionResponse(
        UUID id,
        int revisionNumber,
        UUID coverMediaId,
        UUID createdBy,
        OffsetDateTime createdAt) {

    public static AdminHomeHeroRevisionResponse from(HomeHeroContentRepository.Revision revision) {
        return new AdminHomeHeroRevisionResponse(
                revision.id(), revision.revisionNumber(), revision.coverMediaId(),
                revision.createdBy(), revision.createdAt());
    }
}
