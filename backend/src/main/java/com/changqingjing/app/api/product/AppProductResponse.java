package com.changqingjing.app.api.product;

import java.util.List;
import java.util.UUID;

public record AppProductResponse(
        UUID id,
        String name,
        String summary,
        String coverUrl,
        UUID categoryId,
        String categoryName,
        List<AppProductBlockResponse> blocks,
        String specification) {
}
