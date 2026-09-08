package com.changqingjing.admin.auth;

import java.io.Serial;
import java.io.Serializable;
import java.security.Principal;
import java.time.Instant;
import java.util.UUID;

public record AdminPrincipal(
        UUID accountId,
        String loginName,
        String displayName,
        AdminRole role,
        long accountVersion,
        Instant authenticatedAt) implements Principal, Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Override
    public String getName() {
        return loginName;
    }
}
