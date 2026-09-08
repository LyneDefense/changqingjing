package com.changqingjing.admin.api.staff;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.staff.AdminStaffService;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.common.web.ApiTraceFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/staff")
public class AdminStaffController {

    private final AdminStaffService staffService;

    public AdminStaffController(AdminStaffService staffService) {
        this.staffService = staffService;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminStaffResponse>> search(
            @Valid AdminStaffQuery query) {
        return ApiResponse.of(staffService.search(query));
    }

    @PostMapping
    public ApiResponse<AdminStaffResponse> create(
            @Valid @RequestBody CreateAdminStaffRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(staffService.create(
                request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PatchMapping("/{accountId}")
    public ApiResponse<AdminStaffResponse> update(
            @PathVariable UUID accountId,
            @Valid @RequestBody UpdateAdminStaffRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(staffService.update(
                accountId, request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @PostMapping("/{accountId}/reset-password")
    public ApiResponse<AdminStaffResponse> resetPassword(
            @PathVariable UUID accountId,
            @Valid @RequestBody ResetAdminPasswordRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(staffService.resetPassword(
                accountId, request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }
}
