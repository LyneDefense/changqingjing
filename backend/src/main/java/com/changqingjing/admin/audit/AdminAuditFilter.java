package com.changqingjing.admin.audit;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.web.ApiTraceFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

public class AdminAuditFilter extends OncePerRequestFilter {
    private final AdminAuditService audit;
    private final AdminAuditSnapshot snapshots;
    public AdminAuditFilter(AdminAuditService audit, AdminAuditSnapshot snapshots) {
        this.audit = audit; this.snapshots = snapshots;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        AdminAuditOperation operation = AdminAuditOperation.resolve(request.getMethod(), request.getRequestURI());
        if (operation == null) { chain.doFilter(request, response); return; }
        AdminPrincipal actor = actor(request);
        boolean privateTarget = operation.targetType().equals("APP_USER") || operation.targetType().equals("ADMIN_ACCOUNT");
        var before = actor == null || (privateTarget && actor.role() != com.changqingjing.admin.auth.AdminRole.ADMIN)
                ? Map.<String, Object>of()
                : snapshots.read(operation.targetType(), operation.targetId(), operation.kind());
        var context = new AdminAuditContext(request, operation, actor, before);
        AdminAuditContext.CURRENT.set(context);
        boolean threw = false;
        try { chain.doFilter(request, response); }
        catch (ServletException | IOException | RuntimeException exception) { threw = true; throw exception; }
        finally {
            try {
                if (!context.recorded) {
                    boolean success = !threw && response.getStatus() < 400;
                    // Only record whitelisted business handlers; security rejections are failures.
                    audit.recordRequestOutcome(actor == null ? null : actor.accountId(), operation,
                            success, ApiTraceFilter.currentTraceId(request), response.getStatus());
                }
                if (context.failureRecorded || threw || response.getStatus() >= 400)
                    audit.completeFailureMetadata(ApiTraceFilter.currentTraceId(request), threw ? 500 : response.getStatus());
            } finally { AdminAuditContext.CURRENT.remove(); }
        }
    }

    private AdminPrincipal actor(HttpServletRequest request) {
        var session = request.getSession(false);
        if (session == null) return null;
        Object value = session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        if (value instanceof SecurityContext context && context.getAuthentication() != null
                && context.getAuthentication().getPrincipal() instanceof AdminPrincipal principal) return principal;
        return null;
    }
}
