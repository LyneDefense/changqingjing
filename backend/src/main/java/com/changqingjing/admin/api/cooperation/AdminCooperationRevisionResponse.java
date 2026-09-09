package com.changqingjing.admin.api.cooperation;

import com.changqingjing.content.CooperationContentRepository;
import com.changqingjing.content.CooperationRevenueSection;
import com.changqingjing.content.CooperationValueSection;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminCooperationRevisionResponse(
        UUID id,
        int revisionNumber,
        String title,
        String summary,
        List<CooperationRevenueSection> revenueSections,
        List<CooperationValueSection> valueSections,
        UUID createdBy,
        OffsetDateTime createdAt) {

    public static AdminCooperationRevisionResponse from(
            CooperationContentRepository.Revision revision) {
        return new AdminCooperationRevisionResponse(
                revision.id(),
                revision.revisionNumber(),
                revision.title(),
                revision.summary(),
                revision.revenueSections(),
                revision.valueSections(),
                revision.createdBy(),
                revision.createdAt());
    }
}
