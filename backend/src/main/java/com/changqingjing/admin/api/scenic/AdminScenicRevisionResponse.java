package com.changqingjing.admin.api.scenic;

import com.changqingjing.content.ScenicContentBlock;
import com.changqingjing.content.ScenicContentRepository;
import com.changqingjing.content.ScenicLocation;
import com.changqingjing.content.ScenicOpenStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminScenicRevisionResponse(
        UUID id,
        int revisionNumber,
        String title,
        String summary,
        UUID coverMediaId,
        List<ScenicContentBlock> blocks,
        ScenicOpenStatus openStatus,
        int displayOrder,
        ScenicLocation location,
        UUID createdBy,
        OffsetDateTime createdAt) {

    public static AdminScenicRevisionResponse from(ScenicContentRepository.Revision revision) {
        return new AdminScenicRevisionResponse(
                revision.id(),
                revision.revisionNumber(),
                revision.title(),
                revision.summary(),
                revision.coverMediaId(),
                revision.blocks(),
                revision.openStatus(),
                revision.displayOrder(),
                revision.location(),
                revision.createdBy(),
                revision.createdAt());
    }
}
