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
public class ProductCatalogRepository {

    static final String CATEGORY_KIND = "PRODUCT_CATEGORY";
    static final String PRODUCT_KIND = "PRODUCT";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public ProductCatalogRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public Optional<Entry> findEntry(String kind, UUID entryId, boolean forUpdate) {
        String lock = forUpdate ? " FOR UPDATE" : "";
        return jdbcTemplate.query("""
                SELECT id, kind, draft_revision_id, published_revision_id, visibility,
                       lock_version, first_published_at, updated_at
                FROM content_entry
                WHERE kind = ? AND id = ?
                """ + lock, this::mapEntry, kind, entryId).stream().findFirst();
    }

    public Entry insertEntry(String kind, UUID id, UUID actorId, OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_entry (
                    id, kind, business_key, visibility, lock_version,
                    created_by, updated_by, created_at, updated_at
                ) VALUES (?, ?, ?, 'HIDDEN', 0, ?, ?, ?, ?)
                """, id, kind, id.toString(), actorId, actorId, now, now);
        return new Entry(id, kind, null, null, "HIDDEN", 0, null, now);
    }

    public int nextRevisionNumber(UUID entryId) {
        Integer number = jdbcTemplate.queryForObject(
                "SELECT COALESCE(max(revision_no), 0) + 1 FROM content_revision WHERE entry_id = ?",
                Integer.class,
                entryId);
        return number == null ? 1 : number;
    }

    public CategoryRevision insertCategoryRevision(
            UUID revisionId,
            UUID entryId,
            int revisionNumber,
            String name,
            int displayOrder,
            UUID actorId,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_revision (
                    id, entry_id, revision_no, schema_version, title, display_order,
                    payload, created_by, created_at
                ) VALUES (?, ?, ?, 1, ?, ?, '{}'::jsonb, ?, ?)
                """, revisionId, entryId, revisionNumber, name, displayOrder, actorId, now);
        return new CategoryRevision(
                revisionId, revisionNumber, name, displayOrder, actorId, now);
    }

    public ProductRevision insertProductRevision(
            UUID revisionId,
            UUID entryId,
            int revisionNumber,
            String name,
            String summary,
            UUID categoryId,
            UUID coverMediaId,
            List<UUID> listImageMediaIds,
            List<CompanyContentBlock> blocks,
            String specification,
            int displayOrder,
            UUID actorId,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO content_revision (
                    id, entry_id, revision_no, schema_version, title, summary,
                    cover_media_id, category_entry_id, display_order, payload,
                    created_by, created_at
                ) VALUES (?, ?, ?, 2, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
                """,
                revisionId,
                entryId,
                revisionNumber,
                name,
                summary,
                coverMediaId,
                categoryId,
                displayOrder,
                toPayload(listImageMediaIds, blocks, specification),
                actorId,
                now);
        if (coverMediaId != null) insertMedia(revisionId, coverMediaId, "COVER", 0);
        for (int index = 0; index < listImageMediaIds.size(); index++) {
            insertMedia(revisionId, listImageMediaIds.get(index), "LIST_IMAGE", index);
        }
        for (int index = 0; index < blocks.size(); index++) {
            CompanyContentBlock block = blocks.get(index);
            if (block.type() == CompanyBlockType.IMAGE && block.mediaId() != null) {
                insertMedia(revisionId, block.mediaId(), "DETAIL_IMAGE", index);
            }
        }
        return new ProductRevision(
                revisionId,
                revisionNumber,
                name,
                summary,
                categoryId,
                coverMediaId,
                List.copyOf(listImageMediaIds),
                List.copyOf(blocks),
                specification,
                displayOrder,
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

    public boolean deleteProduct(UUID entryId, long expectedVersion) {
        return jdbcTemplate.update("""
                DELETE FROM content_entry
                WHERE id = ? AND kind = 'PRODUCT' AND visibility = 'HIDDEN'
                  AND lock_version = ?
                """, entryId, expectedVersion) == 1;
    }

    public Optional<CategoryRevision> findCategoryRevision(UUID revisionId) {
        if (revisionId == null) return Optional.empty();
        return jdbcTemplate.query("""
                SELECT id, revision_no, title, display_order, created_by, created_at
                FROM content_revision WHERE id = ?
                """, this::mapCategoryRevision, revisionId).stream().findFirst();
    }

    public Optional<ProductRevision> findProductRevision(UUID revisionId) {
        if (revisionId == null) return Optional.empty();
        return jdbcTemplate.query("""
                SELECT id, revision_no, title, summary, category_entry_id,
                       cover_media_id, display_order, payload, created_by, created_at
                FROM content_revision WHERE id = ?
                """, this::mapProductRevision, revisionId).stream().findFirst();
    }

    public List<Entry> listCategories() {
        return jdbcTemplate.query("""
                SELECT id, kind, draft_revision_id, published_revision_id, visibility,
                       lock_version, first_published_at, updated_at
                FROM content_entry
                WHERE kind = 'PRODUCT_CATEGORY'
                ORDER BY updated_at DESC, id
                """, this::mapEntry);
    }

    public List<PublishedCategoryRow> listPublishedCategories() {
        return jdbcTemplate.query("""
                SELECT e.id AS entry_id, r.id, r.revision_no, r.title,
                       r.display_order, r.created_by, r.created_at
                FROM content_entry e
                JOIN content_revision r ON r.id = e.published_revision_id
                WHERE e.kind = 'PRODUCT_CATEGORY' AND e.visibility = 'PUBLISHED'
                ORDER BY r.display_order, r.title, e.id
                """, (rows, row) -> new PublishedCategoryRow(
                        rows.getObject("entry_id", UUID.class),
                        mapCategoryRevision(rows, row)));
    }

    public List<ProductListRow> searchProducts(
            String keyword,
            CatalogPublicationStatus status,
            UUID categoryId,
            PageQuery pageQuery) {
        String statusValue = status == null ? "" : status.name();
        String search = keyword == null ? "" : keyword.strip();
        return jdbcTemplate.query("""
                SELECT e.id, e.kind, e.draft_revision_id, e.published_revision_id,
                       e.visibility, e.lock_version, e.first_published_at, e.updated_at,
                       r.title, r.cover_media_id, r.category_entry_id, r.display_order,
                       cr.title AS category_name
                FROM content_entry e
                JOIN content_revision r ON r.id = COALESCE(e.draft_revision_id, e.published_revision_id)
                LEFT JOIN content_entry ce ON ce.id = r.category_entry_id
                LEFT JOIN content_revision cr ON cr.id = COALESCE(ce.draft_revision_id, ce.published_revision_id)
                WHERE e.kind = 'PRODUCT'
                  AND (? = '' OR r.title ILIKE '%' || ? || '%')
                  AND (CAST(? AS uuid) IS NULL OR r.category_entry_id = ?)
                  AND (
                    ? = ''
                    OR (? = 'ONLINE' AND e.visibility = 'PUBLISHED')
                    OR (? = 'DRAFT' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NULL)
                    OR (? = 'OFFLINE' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NOT NULL)
                  )
                ORDER BY r.display_order, e.updated_at DESC, e.id
                LIMIT ? OFFSET ?
                """,
                this::mapProductListRow,
                search,
                search,
                categoryId,
                categoryId,
                statusValue,
                statusValue,
                statusValue,
                statusValue,
                pageQuery.getPageSize(),
                pageQuery.offset());
    }

    public long countProducts(
            String keyword,
            CatalogPublicationStatus status,
            UUID categoryId) {
        String statusValue = status == null ? "" : status.name();
        String search = keyword == null ? "" : keyword.strip();
        Long count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM content_entry e
                JOIN content_revision r ON r.id = COALESCE(e.draft_revision_id, e.published_revision_id)
                WHERE e.kind = 'PRODUCT'
                  AND (? = '' OR r.title ILIKE '%' || ? || '%')
                  AND (CAST(? AS uuid) IS NULL OR r.category_entry_id = ?)
                  AND (
                    ? = ''
                    OR (? = 'ONLINE' AND e.visibility = 'PUBLISHED')
                    OR (? = 'DRAFT' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NULL)
                    OR (? = 'OFFLINE' AND e.visibility = 'HIDDEN' AND e.first_published_at IS NOT NULL)
                  )
                """,
                Long.class,
                search,
                search,
                categoryId,
                categoryId,
                statusValue,
                statusValue,
                statusValue,
                statusValue);
        return count == null ? 0 : count;
    }

    public List<PublicProductRow> listPublishedProducts(
            String keyword,
            UUID categoryId,
            PageQuery pageQuery) {
        String search = keyword == null ? "" : keyword.strip();
        return jdbcTemplate.query("""
                SELECT e.id, r.id AS revision_id, r.revision_no, r.title, r.summary,
                       r.cover_media_id, r.category_entry_id, r.display_order, r.payload,
                       r.created_by, r.created_at,
                       CASE WHEN ce.visibility = 'PUBLISHED' THEN cr.title ELSE NULL END AS category_name
                FROM content_entry e
                JOIN content_revision r ON r.id = e.published_revision_id
                LEFT JOIN content_entry ce ON ce.id = r.category_entry_id
                LEFT JOIN content_revision cr ON cr.id = ce.published_revision_id
                WHERE e.kind = 'PRODUCT' AND e.visibility = 'PUBLISHED'
                  AND (? = '' OR r.title ILIKE '%' || ? || '%')
                  AND (CAST(? AS uuid) IS NULL
                       OR (r.category_entry_id = ? AND ce.visibility = 'PUBLISHED'))
                ORDER BY r.display_order, e.first_published_at DESC, e.id
                LIMIT ? OFFSET ?
                """,
                this::mapPublicProductRow,
                search,
                search,
                categoryId,
                categoryId,
                pageQuery.getPageSize(),
                pageQuery.offset());
    }

    public long countPublishedProducts(String keyword, UUID categoryId) {
        String search = keyword == null ? "" : keyword.strip();
        Long count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM content_entry e
                JOIN content_revision r ON r.id = e.published_revision_id
                LEFT JOIN content_entry ce ON ce.id = r.category_entry_id
                WHERE e.kind = 'PRODUCT' AND e.visibility = 'PUBLISHED'
                  AND (? = '' OR r.title ILIKE '%' || ? || '%')
                  AND (CAST(? AS uuid) IS NULL
                       OR (r.category_entry_id = ? AND ce.visibility = 'PUBLISHED'))
                """, Long.class, search, search, categoryId, categoryId);
        return count == null ? 0 : count;
    }

    public Optional<PublicProductRow> findPublishedProduct(UUID entryId) {
        return jdbcTemplate.query("""
                SELECT e.id, r.id AS revision_id, r.revision_no, r.title, r.summary,
                       r.cover_media_id, r.category_entry_id, r.display_order, r.payload,
                       r.created_by, r.created_at,
                       CASE WHEN ce.visibility = 'PUBLISHED' THEN cr.title ELSE NULL END AS category_name
                FROM content_entry e
                JOIN content_revision r ON r.id = e.published_revision_id
                LEFT JOIN content_entry ce ON ce.id = r.category_entry_id
                LEFT JOIN content_revision cr ON cr.id = ce.published_revision_id
                WHERE e.kind = 'PRODUCT' AND e.visibility = 'PUBLISHED' AND e.id = ?
                """, this::mapPublicProductRow, entryId).stream().findFirst();
    }

    private void insertMedia(UUID revisionId, UUID mediaId, String usage, int order) {
        jdbcTemplate.update("""
                INSERT INTO content_revision_media (revision_id, media_id, usage, display_order)
                VALUES (?, ?, ?, ?)
                """, revisionId, mediaId, usage, order);
    }

    private String toPayload(
            List<UUID> listImageMediaIds,
            List<CompanyContentBlock> blocks,
            String specification) {
        try {
            return objectMapper.writeValueAsString(
                    new ProductPayload(listImageMediaIds, blocks, specification));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize product content", exception);
        }
    }

    private ProductPayload readPayload(String payload) {
        try {
            ProductPayload result = objectMapper.readValue(payload, ProductPayload.class);
            return new ProductPayload(
                    result.listImageMediaIds() == null ? List.of() : result.listImageMediaIds(),
                    result.blocks() == null ? List.of() : result.blocks(),
                    result.specification());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to deserialize product content", exception);
        }
    }

    private Entry mapEntry(ResultSet rows, int row) throws SQLException {
        return new Entry(
                rows.getObject("id", UUID.class),
                rows.getString("kind"),
                rows.getObject("draft_revision_id", UUID.class),
                rows.getObject("published_revision_id", UUID.class),
                rows.getString("visibility"),
                rows.getLong("lock_version"),
                rows.getObject("first_published_at", OffsetDateTime.class),
                rows.getObject("updated_at", OffsetDateTime.class));
    }

    private CategoryRevision mapCategoryRevision(ResultSet rows, int row) throws SQLException {
        return new CategoryRevision(
                rows.getObject("id", UUID.class),
                rows.getInt("revision_no"),
                rows.getString("title"),
                rows.getInt("display_order"),
                rows.getObject("created_by", UUID.class),
                rows.getObject("created_at", OffsetDateTime.class));
    }

    private ProductRevision mapProductRevision(ResultSet rows, int row) throws SQLException {
        ProductPayload payload = readPayload(rows.getString("payload"));
        UUID coverMediaId = rows.getObject("cover_media_id", UUID.class);
        List<UUID> listImageMediaIds = payload.listImageMediaIds().isEmpty()
                && coverMediaId != null
                ? List.of(coverMediaId)
                : List.copyOf(payload.listImageMediaIds());
        return new ProductRevision(
                rows.getObject("id", UUID.class),
                rows.getInt("revision_no"),
                rows.getString("title"),
                rows.getString("summary"),
                rows.getObject("category_entry_id", UUID.class),
                coverMediaId,
                listImageMediaIds,
                List.copyOf(payload.blocks()),
                payload.specification(),
                rows.getInt("display_order"),
                rows.getObject("created_by", UUID.class),
                rows.getObject("created_at", OffsetDateTime.class));
    }

    private ProductListRow mapProductListRow(ResultSet rows, int row) throws SQLException {
        Entry entry = mapEntry(rows, row);
        return new ProductListRow(
                entry,
                rows.getString("title"),
                rows.getObject("cover_media_id", UUID.class),
                rows.getObject("category_entry_id", UUID.class),
                rows.getString("category_name"),
                rows.getInt("display_order"));
    }

    private PublicProductRow mapPublicProductRow(ResultSet rows, int row) throws SQLException {
        ProductPayload payload = readPayload(rows.getString("payload"));
        UUID coverMediaId = rows.getObject("cover_media_id", UUID.class);
        List<UUID> listImageMediaIds = payload.listImageMediaIds().isEmpty()
                && coverMediaId != null
                ? List.of(coverMediaId)
                : List.copyOf(payload.listImageMediaIds());
        ProductRevision revision = new ProductRevision(
                rows.getObject("revision_id", UUID.class),
                rows.getInt("revision_no"),
                rows.getString("title"),
                rows.getString("summary"),
                rows.getObject("category_entry_id", UUID.class),
                coverMediaId,
                listImageMediaIds,
                List.copyOf(payload.blocks()),
                payload.specification(),
                rows.getInt("display_order"),
                rows.getObject("created_by", UUID.class),
                rows.getObject("created_at", OffsetDateTime.class));
        return new PublicProductRow(
                rows.getObject("id", UUID.class), revision, rows.getString("category_name"));
    }

    public record Entry(
            UUID id,
            String kind,
            UUID draftRevisionId,
            UUID publishedRevisionId,
            String visibility,
            long version,
            OffsetDateTime firstPublishedAt,
            OffsetDateTime updatedAt) {
    }

    public record CategoryRevision(
            UUID id,
            int revisionNumber,
            String name,
            int displayOrder,
            UUID createdBy,
            OffsetDateTime createdAt) {
    }

    public record ProductRevision(
            UUID id,
            int revisionNumber,
            String name,
            String summary,
            UUID categoryId,
            UUID coverMediaId,
            List<UUID> listImageMediaIds,
            List<CompanyContentBlock> blocks,
            String specification,
            int displayOrder,
            UUID createdBy,
            OffsetDateTime createdAt) {
    }

    public record ProductListRow(
            Entry entry,
            String name,
            UUID coverMediaId,
            UUID categoryId,
            String categoryName,
            int displayOrder) {
    }

    public record PublicProductRow(
            UUID entryId,
            ProductRevision revision,
            String categoryName) {
    }

    public record PublishedCategoryRow(UUID entryId, CategoryRevision revision) {
    }

    private record ProductPayload(
            List<UUID> listImageMediaIds,
            List<CompanyContentBlock> blocks,
            String specification) {
    }
}
