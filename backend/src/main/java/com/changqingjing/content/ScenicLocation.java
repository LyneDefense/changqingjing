package com.changqingjing.content;

import java.math.BigDecimal;

public record ScenicLocation(
        String providerName,
        String providerAddress,
        String displayName,
        boolean nameCustomized,
        BigDecimal longitude,
        BigDecimal latitude,
        String coordinateSystem) {
}
