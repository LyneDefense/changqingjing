package com.changqingjing.content;

import com.changqingjing.common.api.PageQuery;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ScenicContentRepository {

    private static final String KIND = "SCENIC";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public ScenicContentRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public Optional<Entry> findEntry(UUID entryId, boolean forUpdate) {
        String lockClause = forUpdate ? " FOR UPDATE OF e" : "";
        return jdbcTemplate.query("""
                SELECT e.id, e.draft_revision_id, e.published_revision_id, e.visibility,
                       e.lock_version, e.first_published_at, e.updated_at,
                       COALESCE(s.view_count, 0) AS view_count
                FROM content_entry e
                LEFT JOIN scenic_stats s ON s.scenic_entry_id = e.id
                WHERE e.kind = ? AND e.id = ?
                """ + lockClause, this::mapEntry, KIND, entryId).stream().findFirst();
    }

    public List<Entry> search(
            String keyword,
            ScenicPublicationStatus status,
            PageQuery pageQuery) {
        String normalizedKeyword = keyword == null ? "" : keyword.strip();
        String statusValue = status == null ? "" : status.name();
        return jdbcTemplate.query("""
                SELECT e.id, e.draft_revision_id, e.published_revision_id, e.visibility,
                       e.lock_version, e.first_published_at, e.updated_at,
                       COALESCE(s.view_count, 0) AS view_count
                FROM content_entry e
                LEFT JOIN content_revision r
                  ON r.id = COALESCE(e.draft_revision_id, e.published_revision_id)
                LEFT JOIN scenic_stats s ON s.scenic_entry_id = e.id
                WHERE e.kind = ?
                  AND (? = '' OR r.title ILIKE '%' || ? || '%')
                  AND (
                    ? = ''
                    OR (? = 'ONLINE' AND e.visibility = 'PUBLISHED')
                    OR (? = 'DRAFT' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NULL)
                    OR (? = 'OFFLINE' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NOT NULL)
                  )
                ORDER BY r.display_order, e.updated_at DESC, e.id
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

    public long count(String keyword, ScenicPublicationStatus status) {
        String normalizedKeyword = keyword == null ? "" : keyword.strip();
        String statusValue = status == null ? "" : status.name();
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
        jdbcTemplate.update("""
                INSERT INTO scenic_stats (scenic_entry_id, view_count, updated_at)
                VALUES (?, 0, ?)
                """, id, now);
        return new Entry(id, null, null, "HIDDEN", 0, null, now, 0);
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
            UUID coverMediaId,
            List<ScenicContentBlock> blocks,
            ScenicOpenStatus openStatus,
            int displayOrder,
            ScenicLocation location,
            UUID actorId,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_revision (
                    id, entry_id, revision_no, schema_version, title, summary,
                    cover_media_id, display_order, longitude, latitude,
                    coordinate_system, payload, created_by, created_at
                ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
                """,
                revisionId,
                entryId,
                revisionNumber,
                title,
                summary,
                coverMediaId,
                displayOrder,
                location == null ? null : location.longitude(),
                location == null ? null : location.latitude(),
                location == null ? null : location.coordinateSystem(),
                toPayload(blocks, openStatus, location),
                actorId,
                now);
        insertMediaReferences(revisionId, coverMediaId, blocks);
        return new Revision(
                revisionId,
                revisionNumber,
                title,
                summary,
                coverMediaId,
                List.copyOf(blocks),
                openStatus,
                displayOrder,
                location,
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
                "DELETE FROM content_entry WHERE id = ? AND kind = ?", entryId, KIND) == 1;
    }

    public Optional<Revision> findRevision(UUID revisionId) {
        if (revisionId == null) return Optional.empty();
        return jdbcTemplate.query("""
                SELECT id, revision_no, title, summary, cover_media_id, display_order,
                       longitude, latitude, coordinate_system, payload, created_by, created_at
                FROM content_revision
                WHERE id = ?
                """, this::mapRevision, revisionId).stream().findFirst();
    }

    public List<Entry> findPublished(PageQuery pageQuery) {
        return jdbcTemplate.query("""
                SELECT e.id, e.draft_revision_id, e.published_revision_id, e.visibility,
                       e.lock_version, e.first_published_at, e.updated_at,
                       COALESCE(s.view_count, 0) AS view_count
                FROM content_entry e
                JOIN content_revision r ON r.id = e.published_revision_id
                LEFT JOIN scenic_stats s ON s.scenic_entry_id = e.id
                WHERE e.kind = ? AND e.visibility = 'PUBLISHED'
                ORDER BY r.display_order, e.first_published_at DESC, e.id
                LIMIT ? OFFSET ?
                """, this::mapEntry, KIND, pageQuery.getPageSize(), pageQuery.offset());
    }

    public long countPublished() {
        Long result = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM content_entry WHERE kind = ? AND visibility = 'PUBLISHED'",
                Long.class,
                KIND);
        return result == null ? 0 : result;
    }

    public boolean recordView(UUID entryId, UUID viewId, OffsetDateTime now) {
        int inserted = jdbcTemplate.update("""
                INSERT INTO scenic_view_receipt (scenic_entry_id, view_id, received_at)
                VALUES (?, ?, ?)
                ON CONFLICT DO NOTHING
                """, entryId, viewId, now);
        if (inserted == 0) return false;
        jdbcTemplate.update("""
                UPDATE scenic_stats SET view_count = view_count + 1, updated_at = ?
                WHERE scenic_entry_id = ?
                """, now, entryId);
        return true;
    }

    private Entry mapEntry(ResultSet rows, int rowNumber) throws SQLException {
        return new Entry(
                rows.getObject("id", UUID.class),
                rows.getObject("draft_revision_id", UUID.class),
                rows.getObject("published_revision_id", UUID.class),
                rows.getString("visibility"),
                rows.getLong("lock_version"),
                rows.getObject("first_published_at", OffsetDateTime.class),
                rows.getObject("updated_at", OffsetDateTime.class),
                rows.getLong("view_count"));
    }

    private Revision mapRevision(ResultSet rows, int rowNumber) throws SQLException {
        ScenicPayload payload = fromPayload(rows.getString("payload"));
        BigDecimal longitude = rows.getBigDecimal("longitude");
        ScenicLocation location = longitude == null ? null : new ScenicLocation(
                payload.providerName(),
                payload.providerAddress(),
                payload.displayName(),
                payload.nameCustomized(),
                longitude,
                rows.getBigDecimal("latitude"),
                rows.getString("coordinate_system"));
        return new Revision(
                rows.getObject("id", UUID.class),
                rows.getInt("revision_no"),
                rows.getString("title"),
                rows.getString("summary"),
                rows.getObject("cover_media_id", UUID.class),
                payload.blocks() == null ? List.of() : List.copyOf(payload.blocks()),
                payload.openStatus(),
                rows.getInt("display_order"),
                location,
                rows.getObject("created_by", UUID.class),
                rows.getObject("created_at", OffsetDateTime.class));
    }

    private void insertMediaReferences(
            UUID revisionId,
            UUID coverMediaId,
            List<ScenicContentBlock> blocks) {
        if (coverMediaId != null) insertMediaReference(revisionId, coverMediaId, "COVER", 0);
        for (int index = 0; index < blocks.size(); index++) {
            ScenicContentBlock block = blocks.get(index);
            if (block.type() == CompanyBlockType.IMAGE) {
                insertMediaReference(revisionId, block.mediaId(), "BODY_IMAGE", index);
            }
        }
    }

    private void insertMediaReference(
            UUID revisionId,
            UUID mediaId,
            String usage,
            int displayOrder) {
        jdbcTemplate.update("""
                INSERT INTO content_revision_media (revision_id, media_id, usage, display_order)
                VALUES (?, ?, ?, ?)
                """, revisionId, mediaId, usage, displayOrder);
    }

    private String toPayload(
            List<ScenicContentBlock> blocks,
            ScenicOpenStatus openStatus,
            ScenicLocation location) {
        try {
            return objectMapper.writeValueAsString(new ScenicPayload(
                    blocks,
                    openStatus,
                    location == null ? null : location.providerName(),
                    location == null ? null : location.providerAddress(),
                    location == null ? null : location.displayName(),
                    location != null && location.nameCustomized()));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Scenic content cannot be serialized", exception);
        }
    }

    private ScenicPayload fromPayload(String payload) {
        try {
            return objectMapper.readValue(payload, ScenicPayload.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored scenic content is invalid", exception);
        }
    }

    private record ScenicPayload(
            List<ScenicContentBlock> blocks,
            ScenicOpenStatus openStatus,
            String providerName,
            String providerAddress,
            String displayName,
            boolean nameCustomized) {
    }

    public record Entry(
            UUID id,
            UUID draftRevisionId,
            UUID publishedRevisionId,
            String visibility,
            long version,
            OffsetDateTime firstPublishedAt,
            OffsetDateTime updatedAt,
            long viewCount) {

        public ScenicPublicationStatus status() {
            if ("PUBLISHED".equals(visibility)) return ScenicPublicationStatus.ONLINE;
            return firstPublishedAt == null
                    ? ScenicPublicationStatus.DRAFT
                    : ScenicPublicationStatus.OFFLINE;
        }
    }

    public record Revision(
            UUID id,
            int revisionNumber,
            String title,
            String summary,
            UUID coverMediaId,
            List<ScenicContentBlock> blocks,
            ScenicOpenStatus openStatus,
            int displayOrder,
            ScenicLocation location,
            UUID createdBy,
            OffsetDateTime createdAt) {
    }
}
