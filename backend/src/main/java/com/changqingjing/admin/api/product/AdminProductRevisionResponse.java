package com.changqingjing.admin.api.product;

import com.changqingjing.content.CompanyContentBlock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminProductRevisionResponse(
        UUID id,
        int revisionNumber,
        String name,
        String summary,
        UUID categoryId,
        UUID coverMediaId,
        List<UUID> listImageMediaIds,
        List<CompanyContentBlock> blocks,
        String specification,
        int displayOrder,
        UUID createdBy,
        OffsetDateTime createdAt) {
}
