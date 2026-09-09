package com.changqingjing.content;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MapSelectionRepository {

    private final JdbcTemplate jdbcTemplate;

    public MapSelectionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Selection insert(
            UUID id,
            UUID actorId,
            String providerName,
            String providerAddress,
            BigDecimal longitude,
            BigDecimal latitude,
            OffsetDateTime expiresAt,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO map_selection (
                    id, actor_id, provider_name, provider_address, longitude, latitude,
                    coordinate_system, expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'GCJ02', ?, ?)
                """,
                id,
                actorId,
                providerName,
                providerAddress,
                longitude,
                latitude,
                expiresAt,
                now);
        return new Selection(
                id,
                actorId,
                providerName,
                providerAddress,
                longitude,
                latitude,
                "GCJ02",
                expiresAt);
    }

    public Optional<Selection> findValid(UUID id, UUID actorId, OffsetDateTime now) {
        return jdbcTemplate.query("""
                SELECT id, actor_id, provider_name, provider_address, longitude, latitude,
                       coordinate_system, expires_at
                FROM map_selection
                WHERE id = ? AND actor_id = ? AND expires_at > ?
                """, this::mapSelection, id, actorId, now).stream().findFirst();
    }

    private Selection mapSelection(ResultSet rows, int rowNumber) throws SQLException {
        return new Selection(
                rows.getObject("id", UUID.class),
                rows.getObject("actor_id", UUID.class),
                rows.getString("provider_name"),
                rows.getString("provider_address"),
                rows.getBigDecimal("longitude"),
                rows.getBigDecimal("latitude"),
                rows.getString("coordinate_system"),
                rows.getObject("expires_at", OffsetDateTime.class));
    }

    public record Selection(
            UUID id,
            UUID actorId,
            String providerName,
            String providerAddress,
            BigDecimal longitude,
            BigDecimal latitude,
            String coordinateSystem,
            OffsetDateTime expiresAt) {
    }
}
