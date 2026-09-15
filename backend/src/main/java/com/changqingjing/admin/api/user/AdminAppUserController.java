package com.changqingjing.admin.api.user;

import com.changqingjing.admin.user.AdminAppUserService;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageResponse;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.web.ApiTraceFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/admin/users")
public class AdminAppUserController {

    private final AdminAppUserService service;

    public AdminAppUserController(AdminAppUserService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminAppUserResponse>> search(
            @Valid AdminAppUserQuery query) {
        return ApiResponse.of(service.search(query));
    }

    @GetMapping("/{userId}")
    public ApiResponse<AdminAppUserResponse> get(@PathVariable UUID userId) {
        return ApiResponse.of(service.get(userId));
    }

    @PatchMapping("/{userId}/status")
    public ApiResponse<AdminAppUserResponse> changeStatus(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateAppUserStatusRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        return ApiResponse.of(service.changeStatus(
                userId, request, actor, ApiTraceFilter.currentTraceId(servletRequest)));
    }

    @DeleteMapping("/{userId}")
    public ApiResponse<String> deleteUser(
            @PathVariable UUID userId,
            @RequestParam @Min(0) long expectedVersion,
            @AuthenticationPrincipal AdminPrincipal actor,
            HttpServletRequest servletRequest) {
        service.delete(userId, expectedVersion, actor, ApiTraceFilter.currentTraceId(servletRequest));
        return ApiResponse.of("deleted");
    }
}
