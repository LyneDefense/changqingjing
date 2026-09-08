package com.changqingjing.media;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MediaAssetRepository {

    private final JdbcTemplate jdbcTemplate;

    public MediaAssetRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Asset insert(
            UUID id,
            String objectKey,
            String originalFilename,
            MediaType mediaType,
            String contentType,
            long sizeBytes,
            MediaPurpose purpose,
            UUID uploadedBy,
            OffsetDateTime now,
            OffsetDateTime uploadExpiresAt) {
        jdbcTemplate.update("""
                INSERT INTO media_asset (
                    id, object_key, original_filename, media_type, content_type,
                    size_bytes, status, purpose, uploaded_by, created_at, updated_at,
                    upload_expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'UPLOADING', ?, ?, ?, ?, ?)
                """,
                id,
                objectKey,
                originalFilename,
                mediaType.name(),
                contentType,
                sizeBytes,
                purpose.name(),
                uploadedBy,
                now,
                now,
                uploadExpiresAt);
        return findById(id).orElseThrow();
    }

    public Optional<Asset> findById(UUID id) {
        return jdbcTemplate.query("""
                SELECT id, object_key, original_filename, media_type, content_type,
                       size_bytes, etag, status, purpose, uploaded_by, created_at,
                       updated_at, verified_at, upload_expires_at, failure_code,
                       verification_attempts, deletion_requested_at, deleted_at
                FROM media_asset
                WHERE id = ?
                """, this::mapAsset, id).stream().findFirst();
    }

    public boolean markVerifying(UUID id, OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE media_asset
                SET status = 'VERIFYING',
                    failure_code = NULL,
                    verification_attempts = verification_attempts + 1,
                    updated_at = ?
                WHERE id = ? AND status IN ('UPLOADING', 'FAILED')
                """, now, id) == 1;
    }

    public void markReady(UUID id, String etag, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE media_asset
                SET status = 'READY', etag = ?, verified_at = ?, updated_at = ?,
                    failure_code = NULL
                WHERE id = ? AND status = 'VERIFYING'
                """, etag, now, now, id);
    }

    public void markFailed(UUID id, String failureCode, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE media_asset
                SET status = 'FAILED', failure_code = ?, updated_at = ?
                WHERE id = ? AND status = 'VERIFYING'
                """, failureCode, now, id);
    }

    public List<UUID> findExpiredCleanupCandidates(OffsetDateTime now, int limit) {
        return jdbcTemplate.queryForList("""
                SELECT id
                FROM media_asset
                WHERE upload_expires_at < ?
                  AND status IN ('UPLOADING', 'VERIFYING', 'FAILED')
                  AND NOT EXISTS (
                      SELECT 1 FROM content_revision_media reference
                      WHERE reference.media_id = media_asset.id
                  )
                ORDER BY upload_expires_at
                LIMIT ?
                """, UUID.class, now, limit);
    }

    public boolean markPendingDeleteIfUnreferenced(UUID id, OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE media_asset
                SET status = 'PENDING_DELETE', deletion_requested_at = ?, updated_at = ?
                WHERE id = ?
                  AND status IN ('UPLOADING', 'VERIFYING', 'FAILED')
                  AND NOT EXISTS (
                      SELECT 1 FROM content_revision_media reference
                      WHERE reference.media_id = media_asset.id
                  )
                """, now, now, id) == 1;
    }

    public void markDeleted(UUID id, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE media_asset
                SET status = 'DELETED', deleted_at = ?, updated_at = ?
                WHERE id = ? AND status = 'PENDING_DELETE'
                """, now, now, id);
    }

    public void markCleanupFailed(UUID id, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE media_asset
                SET status = 'FAILED', cleanup_attempts = cleanup_attempts + 1, updated_at = ?
                WHERE id = ? AND status = 'PENDING_DELETE'
                """, now, id);
    }

    private Asset mapAsset(ResultSet rows, int rowNumber) throws SQLException {
        return new Asset(
                rows.getObject("id", UUID.class),
                rows.getString("object_key"),
                rows.getString("original_filename"),
                MediaType.valueOf(rows.getString("media_type")),
                rows.getString("content_type"),
                rows.getLong("size_bytes"),
                rows.getString("etag"),
                MediaStatus.valueOf(rows.getString("status")),
                MediaPurpose.valueOf(rows.getString("purpose")),
                rows.getObject("uploaded_by", UUID.class),
                rows.getObject("created_at", OffsetDateTime.class),
                rows.getObject("updated_at", OffsetDateTime.class),
                rows.getObject("verified_at", OffsetDateTime.class),
                rows.getObject("upload_expires_at", OffsetDateTime.class),
                rows.getString("failure_code"),
                rows.getInt("verification_attempts"),
                rows.getObject("deletion_requested_at", OffsetDateTime.class),
                rows.getObject("deleted_at", OffsetDateTime.class));
    }

    public record Asset(
            UUID id,
            String objectKey,
            String originalFilename,
            MediaType mediaType,
            String contentType,
            long sizeBytes,
            String etag,
            MediaStatus status,
            MediaPurpose purpose,
            UUID uploadedBy,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            OffsetDateTime verifiedAt,
            OffsetDateTime uploadExpiresAt,
            String failureCode,
            int verificationAttempts,
            OffsetDateTime deletionRequestedAt,
            OffsetDateTime deletedAt) {
    }
}
