package com.changqingjing.content;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class HomeVideoContentRepository {

    private static final String KIND = "HOME_VIDEO";
    private static final String BUSINESS_KEY = "primary";
    private static final long HOME_VIDEO_ENTRY_LOCK = 495_122_061_142L;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public HomeVideoContentRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void lockSingletonCreation() {
        jdbcTemplate.queryForObject(
                "SELECT pg_advisory_xact_lock(?)",
                (resultSet, rowNumber) -> Boolean.TRUE,
                HOME_VIDEO_ENTRY_LOCK);
    }

    public Optional<Entry> findEntry(boolean forUpdate) {
        String lockClause = forUpdate ? " FOR UPDATE" : "";
        return jdbcTemplate.query("""
                SELECT id, draft_revision_id, published_revision_id, visibility,
                       lock_version, first_published_at, updated_at
                FROM content_entry
                WHERE kind = ? AND business_key = ?
                """ + lockClause, this::mapEntry, KIND, BUSINESS_KEY).stream().findFirst();
    }

    public Entry insertEntry(UUID id, UUID actorId, OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_entry (
                    id, kind, business_key, visibility, lock_version,
                    created_by, updated_by, created_at, updated_at
                ) VALUES (?, ?, ?, 'HIDDEN', 0, ?, ?, ?, ?)
                """, id, KIND, BUSINESS_KEY, actorId, actorId, now, now);
        return new Entry(id, null, null, "HIDDEN", 0, null, now);
    }

    public int nextRevisionNumber(UUID entryId) {
        Integer result = jdbcTemplate.queryForObject(
                "SELECT COALESCE(max(revision_no), 0) + 1 FROM content_revision WHERE entry_id = ?",
                Integer.class,
                entryId);
        return result == null ? 1 : result;
    }

    public Revision insertRevision(
            UUID revisionId,
            UUID entryId,
            int revisionNumber,
            String title,
            UUID coverMediaId,
            UUID videoMediaId,
            boolean displayEnabled,
            UUID actorId,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_revision (
                    id, entry_id, revision_no, schema_version, title,
                    cover_media_id, display_order, payload, created_by, created_at
                ) VALUES (?, ?, ?, 1, ?, ?, 0, ?::jsonb, ?, ?)
                """,
                revisionId,
                entryId,
                revisionNumber,
                title,
                coverMediaId,
                toPayload(videoMediaId, displayEnabled),
                actorId,
                now);
        insertMediaReference(revisionId, coverMediaId, "COVER", 0);
        insertMediaReference(revisionId, videoMediaId, "VIDEO", 0);
        return new Revision(
                revisionId,
                revisionNumber,
                title,
                coverMediaId,
                videoMediaId,
                displayEnabled,
                actorId,
                now);
    }

    public boolean pointDraft(
            UUID entryId,
            UUID revisionId,
            long expectedVersion,
            UUID actorId,
            OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE content_entry
                SET draft_revision_id = ?, updated_by = ?, updated_at = ?,
                    lock_version = lock_version + 1
                WHERE id = ? AND lock_version = ?
                """, revisionId, actorId, now, entryId, expectedVersion) == 1;
    }

    public boolean publish(
            UUID entryId,
            UUID revisionId,
            long expectedVersion,
            UUID actorId,
            OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE content_entry
                SET published_revision_id = ?, visibility = 'PUBLISHED',
                    first_published_at = COALESCE(first_published_at, ?),
                    updated_by = ?, updated_at = ?, lock_version = lock_version + 1
                WHERE id = ? AND lock_version = ?
                """, revisionId, now, actorId, now, entryId, expectedVersion) == 1;
    }

    public boolean unpublish(
            UUID entryId,
            long expectedVersion,
            UUID actorId,
            OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE content_entry
                SET visibility = 'HIDDEN', updated_by = ?, updated_at = ?,
                    lock_version = lock_version + 1
                WHERE id = ? AND lock_version = ?
                """, actorId, now, entryId, expectedVersion) == 1;
    }

    public Optional<Revision> findRevision(UUID revisionId) {
        if (revisionId == null) {
            return Optional.empty();
        }
        return jdbcTemplate.query("""
                SELECT id, revision_no, title, cover_media_id, payload,
                       created_by, created_at
                FROM content_revision
                WHERE id = ?
                """, this::mapRevision, revisionId).stream().findFirst();
    }

    private void insertMediaReference(
            UUID revisionId,
            UUID mediaId,
            String usage,
            int displayOrder) {
        jdbcTemplate.update("""
                INSERT INTO content_revision_media (
                    revision_id, media_id, usage, display_order
                ) VALUES (?, ?, ?, ?)
                """, revisionId, mediaId, usage, displayOrder);
    }

    private Entry mapEntry(ResultSet rows, int rowNumber) throws SQLException {
        return new Entry(
                rows.getObject("id", UUID.class),
                rows.getObject("draft_revision_id", UUID.class),
                rows.getObject("published_revision_id", UUID.class),
                rows.getString("visibility"),
                rows.getLong("lock_version"),
                rows.getObject("first_published_at", OffsetDateTime.class),
                rows.getObject("updated_at", OffsetDateTime.class));
    }

    private Revision mapRevision(ResultSet rows, int rowNumber) throws SQLException {
        HomeVideoPayload payload = fromPayload(rows.getString("payload"));
        return new Revision(
                rows.getObject("id", UUID.class),
                rows.getInt("revision_no"),
                rows.getString("title"),
                rows.getObject("cover_media_id", UUID.class),
                payload.videoMediaId(),
                payload.displayEnabled(),
                rows.getObject("created_by", UUID.class),
                rows.getObject("created_at", OffsetDateTime.class));
    }

    private String toPayload(UUID videoMediaId, boolean displayEnabled) {
        try {
            return objectMapper.writeValueAsString(
                    new HomeVideoPayload(videoMediaId, displayEnabled));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Home video cannot be serialized", exception);
        }
    }

    private HomeVideoPayload fromPayload(String payload) {
        try {
            return objectMapper.readValue(payload, HomeVideoPayload.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored home video is invalid", exception);
        }
    }

    private record HomeVideoPayload(UUID videoMediaId, boolean displayEnabled) {
    }

    public record Entry(
            UUID id,
            UUID draftRevisionId,
            UUID publishedRevisionId,
            String visibility,
            long version,
            OffsetDateTime firstPublishedAt,
            OffsetDateTime updatedAt) {
    }

    public record Revision(
            UUID id,
            int revisionNumber,
            String title,
            UUID coverMediaId,
            UUID videoMediaId,
            boolean displayEnabled,
            UUID createdBy,
            OffsetDateTime createdAt) {
    }
}
