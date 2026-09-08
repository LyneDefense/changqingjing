package com.changqingjing.content;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CompanyContentRepository {

    private static final String KIND = "COMPANY";
    private static final String BUSINESS_KEY = "primary";
    private static final long COMPANY_ENTRY_LOCK = 495_122_061_141L;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public CompanyContentRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void lockSingletonCreation() {
        jdbcTemplate.queryForObject(
                "SELECT pg_advisory_xact_lock(?)",
                (resultSet, rowNumber) -> Boolean.TRUE,
                COMPANY_ENTRY_LOCK);
    }

    public Optional<Entry> findEntry(boolean forUpdate) {
        String lockClause = forUpdate ? " FOR UPDATE" : "";
        return jdbcTemplate.query("""
                SELECT id, draft_revision_id, published_revision_id, visibility, lock_version,
                       first_published_at, created_at, updated_at
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
        return new Entry(id, null, null, "HIDDEN", 0, null, now, now);
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
            String summary,
            List<CompanyContentBlock> blocks,
            UUID actorId,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_revision (
                    id, entry_id, revision_no, schema_version, title, summary,
                    display_order, payload, created_by, created_at
                ) VALUES (?, ?, ?, 1, ?, ?, 0, ?::jsonb, ?, ?)
                """,
                revisionId,
                entryId,
                revisionNumber,
                title,
                summary,
                toPayload(blocks),
                actorId,
                now);
        return new Revision(
                revisionId, revisionNumber, title, summary, List.copyOf(blocks), actorId, now);
    }

    public boolean pointDraft(
            UUID entryId,
            UUID revisionId,
            long expectedVersion,
            UUID actorId,
            OffsetDateTime now) {
        return jdbcTemplate.update("""
                UPDATE content_entry
                SET draft_revision_id = ?,
                    updated_by = ?,
                    updated_at = ?,
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
                SET published_revision_id = ?,
                    visibility = 'PUBLISHED',
                    first_published_at = COALESCE(first_published_at, ?),
                    updated_by = ?,
                    updated_at = ?,
                    lock_version = lock_version + 1
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
                SET visibility = 'HIDDEN',
                    updated_by = ?,
                    updated_at = ?,
                    lock_version = lock_version + 1
                WHERE id = ? AND lock_version = ?
                """, actorId, now, entryId, expectedVersion) == 1;
    }

    public Optional<Revision> findRevision(UUID revisionId) {
        if (revisionId == null) {
            return Optional.empty();
        }
        return jdbcTemplate.query("""
                SELECT id, revision_no, title, summary, payload, created_by, created_at
                FROM content_revision
                WHERE id = ?
                """, this::mapRevision, revisionId).stream().findFirst();
    }

    private Entry mapEntry(ResultSet rows, int rowNumber) throws SQLException {
        return new Entry(
                rows.getObject("id", UUID.class),
                rows.getObject("draft_revision_id", UUID.class),
                rows.getObject("published_revision_id", UUID.class),
                rows.getString("visibility"),
                rows.getLong("lock_version"),
                rows.getObject("first_published_at", OffsetDateTime.class),
                rows.getObject("created_at", OffsetDateTime.class),
                rows.getObject("updated_at", OffsetDateTime.class));
    }

    private Revision mapRevision(ResultSet rows, int rowNumber) throws SQLException {
        return new Revision(
                rows.getObject("id", UUID.class),
                rows.getInt("revision_no"),
                rows.getString("title"),
                rows.getString("summary"),
                fromPayload(rows.getString("payload")),
                rows.getObject("created_by", UUID.class),
                rows.getObject("created_at", OffsetDateTime.class));
    }

    private String toPayload(List<CompanyContentBlock> blocks) {
        try {
            return objectMapper.writeValueAsString(new CompanyPayload(blocks));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Company content cannot be serialized", exception);
        }
    }

    private List<CompanyContentBlock> fromPayload(String payload) {
        try {
            CompanyPayload result = objectMapper.readValue(payload, CompanyPayload.class);
            return result.blocks() == null ? List.of() : List.copyOf(result.blocks());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored company content is invalid", exception);
        }
    }

    private record CompanyPayload(List<CompanyContentBlock> blocks) {
    }

    public record Entry(
            UUID id,
            UUID draftRevisionId,
            UUID publishedRevisionId,
            String visibility,
            long version,
            OffsetDateTime firstPublishedAt,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {
    }

    public record Revision(
            UUID id,
            int revisionNumber,
            String title,
            String summary,
            List<CompanyContentBlock> blocks,
            UUID createdBy,
            OffsetDateTime createdAt) {
    }
}
