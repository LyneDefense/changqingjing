package com.changqingjing.content;

import com.changqingjing.common.api.PageQuery;
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
public class HomeVideoContentRepository {

    private static final String KIND = "HOME_VIDEO";
    private static final long HOME_VIDEO_SET_LOCK = 495_122_061_142L;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public HomeVideoContentRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void lockVideoSet() {
        jdbcTemplate.queryForObject(
                "SELECT pg_advisory_xact_lock(?)",
                (resultSet, rowNumber) -> Boolean.TRUE,
                HOME_VIDEO_SET_LOCK);
    }

    public Optional<Entry> findEntry(UUID entryId, boolean forUpdate) {
        String lockClause = forUpdate ? " FOR UPDATE" : "";
        return jdbcTemplate.query("""
                SELECT id, draft_revision_id, published_revision_id, visibility,
                       lock_version, first_published_at, updated_at
                FROM content_entry
                WHERE kind = ? AND id = ?
                """ + lockClause, this::mapEntry, KIND, entryId).stream().findFirst();
    }

    public Optional<Entry> findPublishedEntry() {
        return jdbcTemplate.query("""
                SELECT id, draft_revision_id, published_revision_id, visibility,
                       lock_version, first_published_at, updated_at
                FROM content_entry
                WHERE kind = ? AND visibility = 'PUBLISHED'
                ORDER BY updated_at DESC, id
                LIMIT 1
                """, this::mapEntry, KIND).stream().findFirst();
    }

    public List<Entry> search(String keyword, HomeVideoStatus status, PageQuery pageQuery) {
        String statusValue = status == null ? "" : status.name();
        String normalizedKeyword = keyword == null ? "" : keyword.strip();
        return jdbcTemplate.query("""
                SELECT e.id, e.draft_revision_id, e.published_revision_id, e.visibility,
                       e.lock_version, e.first_published_at, e.updated_at
                FROM content_entry e
                LEFT JOIN content_revision r
                  ON r.id = COALESCE(e.draft_revision_id, e.published_revision_id)
                WHERE e.kind = ?
                  AND (? = '' OR r.title ILIKE '%' || ? || '%')
                  AND (
                    ? = ''
                    OR (? = 'ONLINE' AND e.visibility = 'PUBLISHED')
                    OR (? = 'DRAFT' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NULL)
                    OR (? = 'OFFLINE' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NOT NULL)
                  )
                ORDER BY e.updated_at DESC, e.id
                LIMIT ? OFFSET ?
                """,
                this::mapEntry,
                KIND,
                normalizedKeyword,
                normalizedKeyword,
                statusValue,
                statusValue,
                statusValue,
                statusValue,
                pageQuery.getPageSize(),
                pageQuery.offset());
    }

    public long count(String keyword, HomeVideoStatus status) {
        String statusValue = status == null ? "" : status.name();
        String normalizedKeyword = keyword == null ? "" : keyword.strip();
        Long result = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM content_entry e
                LEFT JOIN content_revision r
                  ON r.id = COALESCE(e.draft_revision_id, e.published_revision_id)
                WHERE e.kind = ?
                  AND (? = '' OR r.title ILIKE '%' || ? || '%')
                  AND (
                    ? = ''
                    OR (? = 'ONLINE' AND e.visibility = 'PUBLISHED')
                    OR (? = 'DRAFT' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NULL)
                    OR (? = 'OFFLINE' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NOT NULL)
                  )
                """,
                Long.class,
                KIND,
                normalizedKeyword,
                normalizedKeyword,
                statusValue,
                statusValue,
                statusValue,
                statusValue);
        return result == null ? 0 : result;
    }

    public Entry insertEntry(UUID id, UUID actorId, OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_entry (
                    id, kind, business_key, visibility, lock_version,
                    created_by, updated_by, created_at, updated_at
                ) VALUES (?, ?, ?, 'HIDDEN', 0, ?, ?, ?, ?)
                """, id, KIND, id.toString(), actorId, actorId, now, now);
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
                toPayload(videoMediaId),
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
                true,
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
                WHERE id = ? AND kind = ? AND lock_version = ?
                """, revisionId, actorId, now, entryId, KIND, expectedVersion) == 1;
    }

    public void unpublishOtherEntries(UUID entryId, UUID actorId, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE content_entry
                SET visibility = 'HIDDEN', updated_by = ?, updated_at = ?,
                    lock_version = lock_version + 1
                WHERE kind = ? AND visibility = 'PUBLISHED' AND id <> ?
                """, actorId, now, KIND, entryId);
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
                WHERE id = ? AND kind = ? AND lock_version = ?
                """, revisionId, now, actorId, now, entryId, KIND, expectedVersion) == 1;
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
                WHERE id = ? AND kind = ? AND lock_version = ?
                """, actorId, now, entryId, KIND, expectedVersion) == 1;
    }

    public boolean deleteHidden(UUID entryId, long expectedVersion) {
        int updated = jdbcTemplate.update("""
                UPDATE content_entry
                SET draft_revision_id = NULL, published_revision_id = NULL
                WHERE id = ? AND kind = ? AND visibility = 'HIDDEN' AND lock_version = ?
                """, entryId, KIND, expectedVersion);
        if (updated != 1) return false;
        return jdbcTemplate.update(
                "DELETE FROM content_entry WHERE id = ? AND kind = ?",
                entryId,
                KIND) == 1;
    }

    public Optional<Revision> findRevision(UUID revisionId) {
        if (revisionId == null) return Optional.empty();
        return jdbcTemplate.query("""
                SELECT id, revision_no, title, cover_media_id, payload,
                       created_by, created_at
                FROM content_revision
                WHERE id = ?
                """, this::mapRevision, revisionId).stream().findFirst();
    }

    private void insertMediaReference(UUID revisionId, UUID mediaId, String usage, int displayOrder) {
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

    private String toPayload(UUID videoMediaId) {
        try {
            return objectMapper.writeValueAsString(new HomeVideoPayload(videoMediaId, true));
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

        public HomeVideoStatus status() {
            if ("PUBLISHED".equals(visibility)) return HomeVideoStatus.ONLINE;
            return firstPublishedAt == null ? HomeVideoStatus.DRAFT : HomeVideoStatus.OFFLINE;
        }
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
