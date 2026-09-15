package com.changqingjing.admin.audit;

import com.changqingjing.admin.auth.AdminPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

final class AdminAuditContext {
    static final ThreadLocal<AdminAuditContext> CURRENT = new ThreadLocal<>();
    final HttpServletRequest request;
    final AdminAuditOperation operation;
    final AdminPrincipal actor;
    final Map<String, Object> before;
    boolean recorded;
    boolean failureRecorded;

    AdminAuditContext(HttpServletRequest request, AdminAuditOperation operation, AdminPrincipal actor,
            Map<String, Object> before) {
        this.request = request;
        this.operation = operation;
        this.actor = actor;
        this.before = before;
    }
}
