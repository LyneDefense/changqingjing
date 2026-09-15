package com.changqingjing.admin.api.audit;

import com.changqingjing.admin.audit.AdminAuditQuery;
import com.changqingjing.admin.audit.AdminAuditQueryService;
import com.changqingjing.admin.audit.AdminAuditResponse;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/audit-events")
public class AdminAuditController {
    private final AdminAuditQueryService service;
    public AdminAuditController(AdminAuditQueryService service) { this.service = service; }
    @GetMapping
    public ApiResponse<PageResponse<AdminAuditResponse>> search(@AuthenticationPrincipal AdminPrincipal actor,
            @Valid @ModelAttribute AdminAuditQuery query) { return ApiResponse.of(service.search(actor, query)); }
    @GetMapping("/{id}")
    public ApiResponse<AdminAuditResponse> detail(@AuthenticationPrincipal AdminPrincipal actor, @PathVariable UUID id) {
        return ApiResponse.of(service.detail(actor, id));
    }
}
