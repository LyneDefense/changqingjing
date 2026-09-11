package com.changqingjing.app.auth;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class AppSessionRepository {

    private final JdbcTemplate jdbcTemplate;

    AppSessionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    void insert(
            UUID id,
            byte[] tokenDigest,
            UUID userId,
            OffsetDateTime createdAt,
            OffsetDateTime expiresAt) {
        jdbcTemplate.update("""
                INSERT INTO app_session (
                    id, token_digest, user_id, created_at, expires_at, last_seen_at, revoked_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL)
                """, id, tokenDigest, userId, createdAt, expiresAt, createdAt);
    }

    Optional<AppSessionRecord> findActive(byte[] tokenDigest, OffsetDateTime now) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject("""
                    SELECT s.user_id, s.expires_at
                    FROM app_session s
                    JOIN app_user u ON u.id = s.user_id
                    WHERE s.token_digest = ?
                      AND s.revoked_at IS NULL
                      AND s.expires_at > ?
                      AND u.status = 'ACTIVE'
                    """, (resultSet, rowNumber) -> new AppSessionRecord(
                            resultSet.getObject("user_id", UUID.class),
                            resultSet.getObject("expires_at", OffsetDateTime.class)),
                    tokenDigest,
                    now));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    void markSeen(byte[] tokenDigest, OffsetDateTime now) {
        jdbcTemplate.update(
                "UPDATE app_session SET last_seen_at = ? WHERE token_digest = ?",
                now,
                tokenDigest);
    }

    void revoke(byte[] tokenDigest, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE app_session
                SET revoked_at = ?
                WHERE token_digest = ? AND revoked_at IS NULL
                """, now, tokenDigest);
    }
}
