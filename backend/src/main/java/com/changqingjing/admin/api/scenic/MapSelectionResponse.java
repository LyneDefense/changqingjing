package com.changqingjing.admin.api.scenic;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record MapSelectionResponse(
        UUID id,
        String providerName,
        String providerAddress,
        BigDecimal longitude,
        BigDecimal latitude,
        String coordinateSystem,
        OffsetDateTime expiresAt) {
}
