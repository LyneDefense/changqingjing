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
public class HomeHeroContentRepository {

    private static final String KIND = "HOME_HERO";
    private static final String BUSINESS_KEY = "primary";
    private static final long CREATION_LOCK = 495_122_061_143L;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public HomeHeroContentRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void lockSingletonCreation() {
        jdbcTemplate.queryForObject(
                "SELECT pg_advisory_xact_lock(?)", (rows, row) -> Boolean.TRUE, CREATION_LOCK);
    }

    public Optional<Entry> findEntry(boolean forUpdate) {
        String lock = forUpdate ? " FOR UPDATE" : "";
        return jdbcTemplate.query("""
                SELECT id, draft_revision_id, published_revision_id, visibility,
                       lock_version, first_published_at, updated_at
                FROM content_entry
                WHERE kind = ? AND business_key = ?
                """ + lock, this::mapEntry, KIND, BUSINESS_KEY).stream().findFirst();
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
        Integer value = jdbcTemplate.queryForObject(
                "SELECT COALESCE(max(revision_no), 0) + 1 FROM content_revision WHERE entry_id = ?",
                Integer.class, entryId);
        return value == null ? 1 : value;
    }

    public Revision insertRevision(
            UUID id,
            UUID entryId,
            int revisionNumber,
            String title,
            String subtitle,
            UUID coverMediaId,
            int focusX,
            int focusY,
            UUID actorId,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_revision (
                    id, entry_id, revision_no, schema_version, title, summary,
                    cover_media_id, display_order, payload, created_by, created_at
                ) VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?::jsonb, ?, ?)
                """, id, entryId, revisionNumber, title, subtitle, coverMediaId,
                payload(focusX, focusY), actorId, now);
        jdbcTemplate.update("""
                INSERT INTO content_revision_media (revision_id, media_id, usage, display_order)
                VALUES (?, ?, 'HERO_IMAGE', 0)
                """, id, coverMediaId);
        return new Revision(id, revisionNumber, title, subtitle, coverMediaId,
                focusX, focusY, actorId, now);
    }

    public boolean pointDraft(
            UUID entryId, UUID revisionId, long version, UUID actorId, OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE content_entry
                SET draft_revision_id = ?, updated_by = ?, updated_at = ?,
                    lock_version = lock_version + 1
                WHERE id = ? AND lock_version = ?
                """, revisionId, actorId, now, entryId, version) == 1;
    }

    public boolean publish(
            UUID entryId, UUID revisionId, long version, UUID actorId, OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE content_entry
                SET published_revision_id = ?, visibility = 'PUBLISHED',
                    first_published_at = COALESCE(first_published_at, ?),
                    updated_by = ?, updated_at = ?, lock_version = lock_version + 1
                WHERE id = ? AND lock_version = ?
                """, revisionId, now, actorId, now, entryId, version) == 1;
    }

    public boolean unpublish(UUID entryId, long version, UUID actorId, OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE content_entry
                SET visibility = 'HIDDEN', updated_by = ?, updated_at = ?,
                    lock_version = lock_version + 1
                WHERE id = ? AND lock_version = ?
                """, actorId, now, entryId, version) == 1;
    }

    public Optional<Revision> findRevision(UUID revisionId) {
        if (revisionId == null) return Optional.empty();
        return jdbcTemplate.query("""
                SELECT id, revision_no, title, summary, cover_media_id, payload,
                       created_by, created_at
                FROM content_revision WHERE id = ?
                """, this::mapRevision, revisionId).stream().findFirst();
    }

    private Entry mapEntry(ResultSet rows, int row) throws SQLException {
        return new Entry(
                rows.getObject("id", UUID.class),
                rows.getObject("draft_revision_id", UUID.class),
                rows.getObject("published_revision_id", UUID.class),
                rows.getString("visibility"), rows.getLong("lock_version"),
                rows.getObject("first_published_at", OffsetDateTime.class),
                rows.getObject("updated_at", OffsetDateTime.class));
    }

    private Revision mapRevision(ResultSet rows, int row) throws SQLException {
        try {
            Focus focus = objectMapper.readValue(rows.getString("payload"), Focus.class);
            return new Revision(
                    rows.getObject("id", UUID.class), rows.getInt("revision_no"),
                    rows.getString("title"), rows.getString("summary"),
                    rows.getObject("cover_media_id", UUID.class), focus.focusX(), focus.focusY(),
                    rows.getObject("created_by", UUID.class),
                    rows.getObject("created_at", OffsetDateTime.class));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored home hero content is invalid", exception);
        }
    }

    private String payload(int focusX, int focusY) {
        try {
            return objectMapper.writeValueAsString(new Focus(focusX, focusY));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Home hero content cannot be serialized", exception);
        }
    }

    private record Focus(int focusX, int focusY) {
    }

    public record Entry(
            UUID id, UUID draftRevisionId, UUID publishedRevisionId, String visibility,
            long version, OffsetDateTime firstPublishedAt, OffsetDateTime updatedAt) {
    }

    public record Revision(
            UUID id, int revisionNumber, String title, String subtitle, UUID coverMediaId,
            int focusX, int focusY, UUID createdBy, OffsetDateTime createdAt) {
    }
}
