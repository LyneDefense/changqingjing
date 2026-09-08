package com.changqingjing.admin.api.auth;

import com.changqingjing.admin.auth.AdminPrincipal;
import java.util.List;
import java.util.UUID;

public record AdminMeResponse(
        UUID id,
        String loginName,
        String displayName,
        String role,
        List<String> permissions) {

    public static AdminMeResponse from(AdminPrincipal principal) {
        return new AdminMeResponse(
                principal.accountId(),
                principal.loginName(),
                principal.displayName(),
                principal.role().name(),
                principal.role().permissions());
    }
}
