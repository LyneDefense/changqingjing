package com.changqingjing.admin.api.content;

import com.changqingjing.content.CompanyContentBlock;
import com.changqingjing.content.CompanyContentRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminCompanyRevisionResponse(
        UUID id,
        int revisionNumber,
        String title,
        String summary,
        List<CompanyContentBlock> blocks,
        UUID createdBy,
        OffsetDateTime createdAt) {

    public static AdminCompanyRevisionResponse from(
            CompanyContentRepository.Revision revision) {
        return new AdminCompanyRevisionResponse(
                revision.id(),
                revision.revisionNumber(),
                revision.title(),
                revision.summary(),
                revision.blocks(),
                revision.createdBy(),
                revision.createdAt());
    }
}
