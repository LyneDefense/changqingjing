package com.changqingjing.app.api.content;

import java.util.List;

public record AppHomeResponse(
        HomeVideoResponse video,
        HomeCompanySummaryResponse company,
        List<HomeScenicSummaryResponse> scenics) {

    public AppHomeResponse {
        scenics = List.copyOf(scenics);
    }
}
