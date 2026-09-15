package com.changqingjing.admin.audit;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.auth.AdminRole;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuditQueryService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public AdminAuditQueryService(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }
    private static final String BASE = """
        FROM admin_audit_event e LEFT JOIN admin_account a ON a.id = e.actor_id
        """;
    private static final String SELECT = """
        SELECT e.*, COALESCE(e.actor_login_name, a.login_name) AS login_name,
            COALESCE(e.actor_display_name, a.display_name) AS display_name
        """;

    @Transactional(readOnly = true)
    public PageResponse<AdminAuditResponse> search(AdminPrincipal actor, AdminAuditQuery query) {
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE TRUE");
        scope(actor, where, args);
        if (query.getFrom() != null && query.getTo() != null && query.getFrom().isAfter(query.getTo()))
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "开始日期不能晚于结束日期");
        var zone = ZoneId.of("Asia/Shanghai");
        if (query.getFrom() != null) { where.append(" AND e.created_at >= ?"); args.add(query.getFrom().atStartOfDay(zone).toOffsetDateTime()); }
        if (query.getTo() != null) { where.append(" AND e.created_at < ?"); args.add(query.getTo().plusDays(1).atStartOfDay(zone).toOffsetDateTime()); }
        if (has(query.getActor())) {
            where.append(" AND (COALESCE(e.actor_login_name, a.login_name, '') ILIKE ? ESCAPE '!' OR COALESCE(e.actor_display_name, a.display_name, '') ILIKE ? ESCAPE '!')");
            args.add(like(query.getActor())); args.add(like(query.getActor()));
        }
        if (has(query.getKeyword())) {
            where.append(" AND (COALESCE(e.target_name, '') ILIKE ? ESCAPE '!' OR COALESCE(e.client_ip, '') ILIKE ? ESCAPE '!')");
            args.add(like(query.getKeyword())); args.add(like(query.getKeyword()));
        }
        if (has(query.getModule())) {
            // Historical events have no stored module; classify the original action without fabricating metadata.
            where.append(" AND COALESCE(e.module, " + historicalModuleSql() + ") = ?"); args.add(query.getModule());
        }
        if (has(query.getResult())) { where.append(" AND e.result = ?"); args.add(query.getResult()); }
        if (has(query.getAction())) {
            switch (query.getAction()) {
                case "PUBLISH" -> where.append(" AND e.action LIKE '%!_PUBLISH' ESCAPE '!'");
                case "UNPUBLISH", "DRAFT_SAVE", "PREVIEW", "DELETE", "LOGIN", "LOGOUT", "CREATE", "UPDATE", "PASSWORD_RESET" -> {
                    where.append(" AND e.action LIKE ? ESCAPE '!'"); args.add("%!_" + query.getAction().replace("_", "!_"));
                }
                case "UPLOAD" -> where.append(" AND e.action LIKE 'MEDIA!_UPLOAD!_%' ESCAPE '!'");
                default -> { }
            }
        }
        long total = jdbc.queryForObject("SELECT count(*) " + BASE + where, Long.class, args.toArray());
        args.add(query.getPageSize()); args.add(query.offset());
        var rows = jdbc.query(SELECT + BASE + where + " ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?", this::row, args.toArray());
        return PageResponse.of(rows, query, total);
    }

    public AdminAuditResponse detail(AdminPrincipal actor, UUID id) {
        List<Object> args = new ArrayList<>(List.of(id));
        var where = new StringBuilder(" WHERE e.id = ?");
        scope(actor, where, args);
        var rows = jdbc.query(SELECT + BASE + where, this::row, args.toArray());
        if (rows.isEmpty()) throw new BusinessException(HttpStatus.NOT_FOUND, "AUDIT_NOT_FOUND", "日志不存在或无权查看");
        return rows.get(0);
    }

    private void scope(AdminPrincipal actor, StringBuilder where, List<Object> args) {
        if (actor == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "请先登录");
        if (actor.role() != AdminRole.ADMIN) { where.append(" AND e.actor_id = ?"); args.add(actor.accountId()); }
    }
    private AdminAuditResponse row(ResultSet rs, int index) throws SQLException {
        String action = rs.getString("action");
        String module = rs.getString("module");
        boolean historical = module == null;
        if (module == null) module = AdminAuditOperation.module(action);
        List<String> changes = new ArrayList<>();
        String json = rs.getString("change_summary");
        if (json != null) try { mapper.readTree(json).forEach(node -> changes.add(node.asText())); }
        catch (JsonProcessingException ignored) { /* PostgreSQL validates stored JSON. */ }
        String label = AdminAuditOperation.actionLabel(action);
        if (action.equals("APP_USER_STATUS_UPDATE")) {
            try {
                String state = mapper.readTree(rs.getString("detail")).path("status").asText();
                if (state.equals("DISABLED")) label = "冻结用户";
                else if (state.equals("ACTIVE")) label = "解冻用户";
            }
            catch (JsonProcessingException ignored) { }
        }
        return new AdminAuditResponse(rs.getObject("id", UUID.class), rs.getObject("actor_id", UUID.class),
                rs.getString("login_name"), rs.getString("display_name"), action, label, module,
                AdminAuditOperation.moduleLabel(module), rs.getString("target_type"), rs.getObject("target_id", UUID.class),
                rs.getString("target_name"), rs.getString("result"), (Boolean) rs.getObject("affects_online"),
                rs.getString("client_ip"), clientSummary(rs.getString("user_agent")), rs.getString("user_agent"),
                rs.getObject("login_batch_id", UUID.class), rs.getString("trace_id"), List.copyOf(changes),
                rs.getString("failure_code"), rs.getObject("created_at", OffsetDateTime.class), historical);
    }
    private boolean has(String value) { return value != null && !value.isBlank(); }
    private String like(String value) { return "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"; }
    private String clientSummary(String ua) {
        if (ua == null || ua.isBlank()) return "未记录";
        String browser = ua.contains("MicroMessenger") ? "微信" : ua.contains("Edg/") ? "Edge"
                : ua.contains("Chrome/") || ua.contains("CriOS/") ? "Chrome"
                : ua.contains("Firefox/") ? "Firefox" : ua.contains("Safari/") ? "Safari" : "其他客户端";
        String os = ua.contains("iPhone") || ua.contains("iPad") ? "iOS" : ua.contains("Android") ? "Android"
                : ua.contains("Windows") ? "Windows" : ua.contains("Macintosh") ? "macOS" : ua.contains("Linux") ? "Linux" : "未知系统";
        return browser + " / " + os;
    }
    private String historicalModuleSql() {
        return """
            CASE WHEN e.action LIKE 'ADMIN!_STAFF!_%' ESCAPE '!' THEN 'STAFF'
                WHEN e.action LIKE 'ADMIN!_%' ESCAPE '!' THEN 'AUTH'
                WHEN e.action LIKE 'APP!_USER!_%' ESCAPE '!' THEN 'USERS'
                WHEN e.action LIKE 'HOME!_HERO!_%' ESCAPE '!' THEN 'HOME_HERO'
                WHEN e.action LIKE 'HOME!_VIDEO!_%' ESCAPE '!' THEN 'HOME_VIDEO'
                WHEN e.action LIKE 'PRODUCT!_%' ESCAPE '!' THEN 'PRODUCT'
                WHEN e.action LIKE 'MAP!_%' ESCAPE '!' THEN 'MAP'
                WHEN e.action LIKE 'COMPANY!_%' ESCAPE '!' THEN 'COMPANY'
                WHEN e.action LIKE 'COOPERATION!_%' ESCAPE '!' THEN 'COOPERATION'
                WHEN e.action LIKE 'SCENIC!_%' ESCAPE '!' THEN 'SCENIC'
                WHEN e.action LIKE 'MEDIA!_%' ESCAPE '!' THEN 'MEDIA' ELSE 'OTHER' END
            """;
    }
}
