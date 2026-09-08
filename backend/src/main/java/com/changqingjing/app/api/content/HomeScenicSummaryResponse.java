package com.changqingjing.app.api.content;

import java.util.UUID;

public record HomeScenicSummaryResponse(
        UUID id,
        String title,
        String summary,
        String coverUrl,
        int displayOrder) {
}
