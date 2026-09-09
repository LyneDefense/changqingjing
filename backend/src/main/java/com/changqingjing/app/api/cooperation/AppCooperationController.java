package com.changqingjing.app.api.cooperation;

import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.content.CooperationContentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app/cooperation")
public class AppCooperationController {

    private final CooperationContentService service;

    public AppCooperationController(CooperationContentService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<AppCooperationResponse> get() {
        return ApiResponse.of(service.getPublished());
    }
}
