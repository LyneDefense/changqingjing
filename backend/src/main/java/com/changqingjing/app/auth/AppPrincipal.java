package com.changqingjing.app.auth;

import java.security.Principal;
import java.util.UUID;

public record AppPrincipal(UUID userId) implements Principal {

    @Override
    public String getName() {
        return userId.toString();
    }
}
