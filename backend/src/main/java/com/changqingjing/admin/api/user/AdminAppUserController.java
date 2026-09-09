package com.changqingjing.admin.api.user;

import com.changqingjing.admin.user.AdminAppUserService;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
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
}
