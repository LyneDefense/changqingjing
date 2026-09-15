package com.changqingjing.admin.audit;

import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Curated projections only. Passwords, phone data, tokens and request bodies are never captured. */
@Component
public class AdminAuditSnapshot {
    private final JdbcTemplate jdbc;
    public AdminAuditSnapshot(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    Map<String, Object> read(String type, UUID id, String kind) {
        String sql;
        Object argument = id;
        if (type.equals("CONTENT_ENTRY")) {
            if (id == null && kind == null) return Map.of();
            sql = """
                SELECT e.id, r.title AS name, r.title, r.summary, r.cover_media_id AS cover,
                    r.display_order, r.longitude, r.latitude, r.category_entry_id, r.payload::text AS payload,
                    COALESCE((SELECT jsonb_agg(jsonb_build_object('media', media_id, 'usage', usage,
                        'order', display_order) ORDER BY usage, display_order)::text
                        FROM content_revision_media WHERE revision_id = r.id), '[]') AS media
                FROM content_entry e LEFT JOIN content_revision r ON r.id = e.draft_revision_id
                WHERE %s
                """.formatted(id != null ? "e.id = ?" : "e.kind = ?");
            if (id == null) argument = kind;
        } else if (id == null) return Map.of();
        else if (type.equals("ADMIN_ACCOUNT"))
            sql = "SELECT id, display_name AS name, login_name, display_name, role, status FROM admin_account WHERE id = ?";
        else if (type.equals("APP_USER"))
            sql = "SELECT id, display_name AS name, status FROM app_user WHERE id = ?";
        else if (type.equals("MEDIA_ASSET"))
            sql = "SELECT id, original_filename AS name, status, failure_code FROM media_asset WHERE id = ?";
        else if (type.equals("MAP_SELECTION"))
            sql = "SELECT id, provider_name AS name FROM map_selection WHERE id = ?";
        else return Map.of();
        var rows = jdbc.queryForList(sql, argument);
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }
}
