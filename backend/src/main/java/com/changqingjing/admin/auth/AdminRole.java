package com.changqingjing.admin.auth;

import java.util.List;

public enum AdminRole {
    ADMIN(List.of("content:read", "content:write", "content:publish", "media:write", "user:read", "staff:manage")),
    OPERATOR(List.of("content:read", "content:write", "content:publish", "media:write"));

    private final List<String> permissions;

    AdminRole(List<String> permissions) {
        this.permissions = permissions;
    }

    public List<String> permissions() {
        return permissions;
    }
}
