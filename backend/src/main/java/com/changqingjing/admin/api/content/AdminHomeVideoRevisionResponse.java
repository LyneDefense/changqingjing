package com.changqingjing.admin.api.content;

import com.changqingjing.content.HomeVideoContentRepository;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminHomeVideoRevisionResponse(
        UUID id,
        int revisionNumber,
        String title,
        UUID videoMediaId,
        UUID coverMediaId,
        boolean displayEnabled,
        UUID createdBy,
        OffsetDateTime createdAt) {

    public static AdminHomeVideoRevisionResponse from(
            HomeVideoContentRepository.Revision revision) {
        return new AdminHomeVideoRevisionResponse(
                revision.id(),
                revision.revisionNumber(),
                revision.title(),
                revision.videoMediaId(),
                revision.coverMediaId(),
                revision.displayEnabled(),
                revision.createdBy(),
                revision.createdAt());
    }
}
