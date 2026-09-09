package com.changqingjing.app.api.product;

import java.util.UUID;

public record AppProductSummaryResponse(
        UUID id,
        String name,
        String summary,
        String coverUrl,
        UUID categoryId,
        String categoryName) {
}
