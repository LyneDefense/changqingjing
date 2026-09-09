package com.changqingjing.app.api.cooperation;

import java.util.List;

public record AppCooperationResponse(
        String title,
        String summary,
        List<AppCooperationRevenueResponse> revenueSections,
        List<AppCooperationValueResponse> valueSections) {
}
