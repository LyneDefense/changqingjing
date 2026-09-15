package com.changqingjing.admin.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AdminAuditService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final AdminAuditSnapshot snapshots;

    public AdminAuditService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.snapshots = new AdminAuditSnapshot(jdbcTemplate);
    }

    @Transactional
    public void recordSuccess(
            UUID actorId,
            String action,
            String targetType,
            UUID targetId,
            String traceId,
            Map<String, ?> detail) {
        record(actorId, action, targetType, targetId, "SUCCESS", traceId, detail);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(
            UUID actorId,
            String action,
            String targetType,
            UUID targetId,
            String traceId) {
        record(actorId, action, targetType, targetId, "FAILURE", traceId, Map.of());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRequestOutcome(UUID actorId, AdminAuditOperation operation, boolean success,
            String traceId, int status) {
        if (operation.action().equals("ADMIN_LOGIN")) actorId = null;
        UUID targetId = operation.targetId();
        var context = AdminAuditContext.CURRENT.get();
        if (targetId == null && context != null && context.request.getAttribute("audit.targetId") instanceof UUID id) targetId = id;
        if (targetId == null && context != null && context.before.get("id") instanceof UUID id) targetId = id;
        if (operation.action().equals("ADMIN_LOGOUT")) targetId = actorId;
        record(actorId, operation.action(), operation.targetType(), targetId,
                success ? "SUCCESS" : "FAILURE", traceId, Map.of("httpStatus", status));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeFailureMetadata(String traceId, int status) {
        var context = AdminAuditContext.CURRENT.get();
        Object code = context == null ? null : context.request.getAttribute("audit.failureCode");
        if (code == null && context != null && context.operation.targetType().equals("MEDIA_ASSET"))
            code = snapshots.read("MEDIA_ASSET", context.operation.targetId(), null).get("failure_code");
        jdbcTemplate.update("UPDATE admin_audit_event SET failure_code = COALESCE(failure_code, ?) WHERE trace_id = ? AND result = 'FAILURE'",
                code == null ? (status < 400 ? "OPERATION_FAILED" : "HTTP_" + status) : code.toString(), traceId);
    }

    private void record(
            UUID actorId,
            String action,
            String targetType,
            UUID targetId,
            String result,
            String traceId,
            Map<String, ?> detail) {
        var context = AdminAuditContext.CURRENT.get();
        var actor = snapshots.read("ADMIN_ACCOUNT", actorId, null);
        boolean restrictedTarget = context != null && context.actor != null
                && context.actor.role() == com.changqingjing.admin.auth.AdminRole.OPERATOR
                && (targetType.equals("APP_USER") || targetType.equals("ADMIN_ACCOUNT"));
        var after = restrictedTarget ? Map.<String, Object>of() : snapshots.read(targetType, targetId,
                context == null ? null : context.operation.kind());
        var before = context == null ? Map.<String, Object>of() : context.before;
        Object targetName = before.get("name") != null && result.equals("FAILURE") ? before.get("name")
                : after.get("name") != null ? after.get("name") : before.get("name");
        Object loginName = actor.get("login_name");
        Object actorDisplayName = actor.get("display_name");
        if (context != null && context.actor != null && context.actor.accountId().equals(actorId)) {
            loginName = context.actor.loginName();
            actorDisplayName = context.actor.displayName();
        }
        if (action.equals("ADMIN_LOGIN") && actorId == null && context != null)
            loginName = context.request.getAttribute("audit.loginName");
        String userAgent = context == null ? null : limit(context.request.getHeader("User-Agent"), 512);
        UUID batch = null;
        if (context != null) {
            Object value = context.request.getAttribute("audit.loginBatch");
            if (value == null && context.request.getSession(false) != null)
                value = context.request.getSession(false).getAttribute("audit.loginBatch");
            if (value instanceof UUID uuid) batch = uuid;
        }
        var summaries = summaries(action, result, before, after, detail);
        jdbcTemplate.update("""
                INSERT INTO admin_audit_event (
                    id, actor_id, action, target_type, target_id, result, trace_id, detail,
                    actor_login_name, actor_display_name, target_name, module, client_ip,
                    user_agent, login_batch_id, affects_online, change_summary, failure_code
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)
                """,
                UUID.randomUUID(),
                actorId,
                action,
                targetType,
                targetId,
                result,
                traceId,
                toJson(detail), loginName == null ? null : limit(loginName.toString(), 100), actorDisplayName,
                targetName, AdminAuditOperation.module(action),
                context == null ? null : limit(context.request.getRemoteAddr(), 100),
                userAgent, batch, result.equals("SUCCESS") && AdminAuditOperation.affectsOnline(action),
                toJson(summaries), context == null ? null : context.request.getAttribute("audit.failureCode"));
        if (context != null) {
            // A rolled-back success must not suppress recording the failed request.
            if (TransactionSynchronizationManager.isSynchronizationActive())
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCommit() { context.recorded = true; context.failureRecorded = result.equals("FAILURE"); }
                });
            else { context.recorded = true; context.failureRecorded = result.equals("FAILURE"); }
        }
    }

    private List<String> summaries(String action, String result, Map<String, Object> before,
            Map<String, Object> after, Map<String, ?> detail) {
        if (result.equals("FAILURE")) return List.of("操作未完成，未确认更新线上内容");
        if (action.equals("APP_USER_STATUS_UPDATE"))
            return List.of("DISABLED".equals(detail.get("status")) ? "冻结账号并使登录失效" : "解冻账号，允许重新登录");
        if (action.endsWith("DRAFT_SAVE") || action.equals("ADMIN_STAFF_UPDATE")) {
            if (before.isEmpty()) return List.of("保存新草稿 / 新资料");
            List<String> changes = new ArrayList<>();
            Map<String, String> fields = Map.of("title", "名称修改", "summary", "简介修改", "cover", "封面变更",
                    "display_order", "展示顺序调整", "payload", "内容板块修改", "category_entry_id", "所属分类修改",
                    "display_name", "显示名称修改", "role", "角色修改", "status", "账号状态修改");
            fields.forEach((key, label) -> { if (!Objects.equals(before.get(key), after.get(key))) changes.add(label); });
            if (!Objects.equals(before.get("longitude"), after.get("longitude"))
                    || !Objects.equals(before.get("latitude"), after.get("latitude"))) changes.add("导航位置修改");
            if (!Objects.equals(before.get("media"), after.get("media"))) {
                var previous = mediaIds(before.get("media"));
                var current = mediaIds(after.get("media"));
                long added = current.stream().filter(id -> !previous.contains(id)).count();
                long removed = previous.stream().filter(id -> !current.contains(id)).count();
                if (added > 0) changes.add("新增 " + added + " 个媒体文件");
                if (removed > 0) changes.add("移除 " + removed + " 个媒体文件");
                if (added == 0 && removed == 0) changes.add("媒体顺序或用途调整");
            }
            return changes.isEmpty() ? List.of("保存草稿 / 资料（无字段变更）") : changes;
        }
        return List.of(switch (action) {
            case "ADMIN_LOGIN" -> "建立后台登录会话"; case "ADMIN_LOGOUT" -> "结束当前登录会话";
            case "ADMIN_STAFF_PASSWORD_RESET" -> "重置密码并使原登录失效（不记录密码）";
            case "APP_USER_DELETE" -> "删除个人资料与微信绑定，并使登录失效";
            case "MEDIA_UPLOAD_CREATE" -> "申请媒体上传授权（不记录临时凭证）";
            case "MEDIA_UPLOAD_VERIFY" -> "校验上传文件";
            default -> action.endsWith("UNPUBLISH") ? "下架线上内容"
                    : action.endsWith("PUBLISH") ? "将当前草稿发布到线上（替换原线上版本）"
                    : action.endsWith("PREVIEW") ? "查看未发布草稿，不影响线上内容"
                    : AdminAuditOperation.actionLabel(action);
        });
    }

    private java.util.Set<String> mediaIds(Object value) {
        var ids = new java.util.HashSet<String>();
        if (value == null) return ids;
        try { objectMapper.readTree(value.toString()).forEach(node -> ids.add(node.path("media").asText())); }
        catch (JsonProcessingException ignored) { /* Stored JSON is validated by PostgreSQL. */ }
        return ids;
    }

    private String limit(String value, int length) {
        return value == null ? null : value.substring(0, Math.min(value.length(), length)).replaceAll("[\\r\\n]", " ");
    }

    private String toJson(Object detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Audit detail cannot be serialized", exception);
        }
    }
}
