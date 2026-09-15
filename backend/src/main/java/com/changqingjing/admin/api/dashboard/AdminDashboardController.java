package com.changqingjing.admin.api.dashboard;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.dashboard.AdminDashboardResponse;
import com.changqingjing.admin.dashboard.AdminDashboardService;
import com.changqingjing.common.api.ApiResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
public class AdminDashboardController {
    private final AdminDashboardService service;
    public AdminDashboardController(AdminDashboardService service) { this.service = service; }
    @GetMapping
    public ApiResponse<AdminDashboardResponse> get(@AuthenticationPrincipal AdminPrincipal actor,
            @RequestParam(defaultValue = "7") int days) { return ApiResponse.of(service.get(actor, days)); }
}
