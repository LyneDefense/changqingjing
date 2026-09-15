package com.changqingjing.admin.audit;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminAuditResponse(UUID id, UUID actorId, String actorLoginName, String actorDisplayName,
        String action, String actionLabel, String module, String moduleLabel, String targetType, UUID targetId,
        String targetName, String result, Boolean affectsOnline, String clientIp, String clientSummary,
        String userAgent, UUID loginBatchId, String traceId, List<String> changeSummary, String failureCode,
        OffsetDateTime createdAt, boolean historical) {}
