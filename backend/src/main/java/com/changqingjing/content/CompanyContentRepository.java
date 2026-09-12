package com.changqingjing.content;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
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
            UUID coverMediaId,
            List<UUID> galleryMediaIds,
            List<CompanyContentBlock> blocks,
            UUID actorId,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_revision (
                    id, entry_id, revision_no, schema_version, title, summary,
                    cover_media_id, display_order, payload, created_by, created_at
                ) VALUES (?, ?, ?, 2, ?, ?, ?, 0, ?::jsonb, ?, ?)
                """,
                revisionId,
                entryId,
                revisionNumber,
                title,
                summary,
                coverMediaId,
                toPayload(blocks, galleryMediaIds),
                actorId,
                now);
        return new Revision(
                revisionId,
                revisionNumber,
                title,
                summary,
                coverMediaId,
                List.copyOf(galleryMediaIds),
                List.copyOf(blocks),
                actorId,
                now);
    }

    public void insertMediaReferences(
            UUID revisionId,
            UUID coverMediaId,
            List<UUID> galleryMediaIds,
            List<CompanyContentBlock> blocks) {
        if (coverMediaId != null) {
            insertMediaReference(revisionId, coverMediaId, "COVER", 0);
        }
        for (int index = 0; index < galleryMediaIds.size(); index++) {
            insertMediaReference(revisionId, galleryMediaIds.get(index), "GALLERY_IMAGE", index);
        }
        for (int index = 0; index < blocks.size(); index++) {
            CompanyContentBlock block = blocks.get(index);
            if (block.type() == CompanyBlockType.IMAGE) {
                insertMediaReference(revisionId, block.mediaId(), "BODY_IMAGE", index);
            }
        }
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
                SELECT id, revision_no, title, summary, cover_media_id, payload,
                       created_by, created_at
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
        CompanyPayload payload = fromPayload(rows.getString("payload"));
        List<CompanyContentBlock> blocks = mergeLegacyGallery(
                payload.blocks() == null ? List.of() : payload.blocks(),
                payload.galleryMediaIds() == null ? List.of() : payload.galleryMediaIds());
        return new Revision(
                rows.getObject("id", UUID.class),
                rows.getInt("revision_no"),
                rows.getString("title"),
                rows.getString("summary"),
                rows.getObject("cover_media_id", UUID.class),
                List.of(),
                blocks,
                rows.getObject("created_by", UUID.class),
                rows.getObject("created_at", OffsetDateTime.class));
    }

    private List<CompanyContentBlock> mergeLegacyGallery(
            List<CompanyContentBlock> blocks,
            List<UUID> galleryMediaIds) {
        if (galleryMediaIds.isEmpty()) {
            return List.copyOf(blocks);
        }
        List<CompanyContentBlock> merged = new ArrayList<>(blocks);
        int insertionIndex = 0;
        for (int index = 0; index < merged.size(); index++) {
            if (merged.get(index).type() == CompanyBlockType.PARAGRAPH) {
                insertionIndex = index + 1;
                break;
            }
        }
        merged.addAll(insertionIndex, galleryMediaIds.stream()
                .map(mediaId -> new CompanyContentBlock(
                        CompanyBlockType.IMAGE, null, mediaId, null))
                .toList());
        return List.copyOf(merged);
    }

    private String toPayload(
            List<CompanyContentBlock> blocks,
            List<UUID> galleryMediaIds) {
        try {
            return objectMapper.writeValueAsString(
                    new CompanyPayload(blocks, galleryMediaIds));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Company content cannot be serialized", exception);
        }
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

    private CompanyPayload fromPayload(String payload) {
        try {
            return objectMapper.readValue(payload, CompanyPayload.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored company content is invalid", exception);
        }
    }

    private record CompanyPayload(
            List<CompanyContentBlock> blocks,
            List<UUID> galleryMediaIds) {
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
            UUID coverMediaId,
            List<UUID> galleryMediaIds,
            List<CompanyContentBlock> blocks,
            UUID createdBy,
            OffsetDateTime createdAt) {

        public Revision(
                UUID id,
                int revisionNumber,
                String title,
                String summary,
                List<CompanyContentBlock> blocks,
                UUID createdBy,
                OffsetDateTime createdAt) {
            this(id, revisionNumber, title, summary, null, List.of(), blocks, createdBy, createdAt);
        }
    }
}
