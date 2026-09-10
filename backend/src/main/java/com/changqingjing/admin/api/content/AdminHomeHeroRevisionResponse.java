package com.changqingjing.admin.api.content;

import com.changqingjing.content.HomeHeroContentRepository;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminHomeHeroRevisionResponse(
        UUID id,
        int revisionNumber,
        String title,
        String subtitle,
        UUID coverMediaId,
        int focusX,
        int focusY,
        UUID createdBy,
        OffsetDateTime createdAt) {

    public static AdminHomeHeroRevisionResponse from(HomeHeroContentRepository.Revision revision) {
        return new AdminHomeHeroRevisionResponse(
                revision.id(), revision.revisionNumber(), revision.title(), revision.subtitle(),
                revision.coverMediaId(), revision.focusX(), revision.focusY(),
                revision.createdBy(), revision.createdAt());
    }
}
