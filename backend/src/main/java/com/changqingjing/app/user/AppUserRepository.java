package com.changqingjing.app.user;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AppUserRepository {

    private static final String USER_COLUMNS = """
            u.id, u.display_name, u.avatar_media_id, u.profile_onboarding_completed_at,
            u.status, u.registered_at, u.last_login_at, u.lock_version,
            p.masked_phone, (p.user_id IS NOT NULL) AS phone_bound,
            EXISTS (SELECT 1 FROM wechat_identity wi2 WHERE wi2.user_id = u.id) AS wechat_bound
            """;

    private final JdbcTemplate jdbcTemplate;

    public AppUserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<AppUserView> findById(UUID id) {
        return findOne("""
                SELECT %s
                FROM app_user u
                LEFT JOIN user_phone p ON p.user_id = u.id
                WHERE u.id = ? AND u.deleted_at IS NULL
                """.formatted(USER_COLUMNS), id);
    }

    public Optional<AppUserView> lockById(UUID id) {
        return findOne("""
                SELECT %s
                FROM app_user u
                LEFT JOIN user_phone p ON p.user_id = u.id
                WHERE u.id = ? AND u.deleted_at IS NULL
                FOR UPDATE OF u
                """.formatted(USER_COLUMNS), id);
    }

    public void changeStatus(UUID id, AppUserStatus status, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE app_user
                SET status = ?, updated_at = ?, lock_version = lock_version + 1
                WHERE id = ? AND deleted_at IS NULL
                """, status.name(), now, id);
        jdbcTemplate.update("DELETE FROM app_session WHERE user_id = ?", id);
    }

    public void deleteAccount(UUID id, OffsetDateTime now) {
        // Keep a minimal tombstone without profile/bindings so COS cleanup metadata is retained.
        jdbcTemplate.update("""
                UPDATE app_user
                SET status = 'DISABLED', deleted_at = ?, updated_at = ?,
                    display_name = NULL, avatar_media_id = NULL,
                    profile_onboarding_completed_at = NULL, last_login_at = NULL,
                    lock_version = lock_version + 1
                WHERE id = ? AND deleted_at IS NULL
                """, now, now, id);
        jdbcTemplate.update("DELETE FROM app_session WHERE user_id = ?", id);
        jdbcTemplate.update("DELETE FROM user_phone WHERE user_id = ?", id);
        jdbcTemplate.update("DELETE FROM wechat_identity WHERE user_id = ?", id);
        // The existing cleanup worker retries unreferenced expired FAILED assets.
        jdbcTemplate.update("""
                UPDATE media_asset
                SET status = 'FAILED', failure_code = 'APP_ACCOUNT_DELETED',
                    upload_expires_at = ?, deletion_requested_at = ?, updated_at = ?
                WHERE uploaded_by_app_user = ? AND status NOT IN ('DELETED', 'PENDING_DELETE')
                  AND NOT EXISTS (SELECT 1 FROM content_revision_media r WHERE r.media_id = media_asset.id)
                  AND NOT EXISTS (SELECT 1 FROM content_revision r WHERE r.cover_media_id = media_asset.id)
                  AND NOT EXISTS (SELECT 1 FROM app_user u WHERE u.avatar_media_id = media_asset.id)
                """, now, now, now, id);
    }

    public Optional<AppUserView> findByWechatIdentity(String appId, String openid) {
        return findOne("""
                SELECT %s
                FROM wechat_identity wi
                JOIN app_user u ON u.id = wi.user_id
                LEFT JOIN user_phone p ON p.user_id = u.id
                WHERE wi.app_id = ? AND wi.openid = ? AND u.deleted_at IS NULL
                """.formatted(USER_COLUMNS), appId, openid);
    }

    public Optional<UUID> findPhoneOwner(byte[] queryDigest) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(
                    "SELECT user_id FROM user_phone WHERE phone_query_digest = ?",
                    UUID.class,
                    queryDigest));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    public void lockRegistrationKeys(String identityKey, String phoneKey) {
        List<String> keys = List.of(identityKey, phoneKey).stream().sorted().toList();
        for (String key : keys) {
            jdbcTemplate.queryForObject(
                    "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
                    (resultSet, rowNumber) -> Boolean.TRUE,
                    key);
        }
    }

    public void insertUser(UUID userId, String displayName, OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO app_user (
                    id, display_name, status, registered_at, last_login_at, updated_at, lock_version
                ) VALUES (?, ?, 'ACTIVE', ?, ?, ?, 0)
                """, userId, displayName, now, now, now);
    }

    public void insertWechatIdentity(
            UUID identityId,
            UUID userId,
            String appId,
            String openid,
            String unionid,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO wechat_identity (
                    id, user_id, app_id, openid, unionid, created_at, last_verified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, identityId, userId, appId, openid, unionid, now, now);
    }

    public void markWechatVerified(
            String appId,
            String openid,
            String unionid,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE wechat_identity
                SET last_verified_at = ?,
                    unionid = COALESCE(?, unionid)
                WHERE app_id = ? AND openid = ?
                """, now, unionid, appId, openid);
    }

    public void upsertPhone(UUID userId, ProtectedPhone phone, OffsetDateTime now) {
        jdbcTemplate.update("""
                INSERT INTO user_phone (
                    user_id, phone_ciphertext, phone_query_digest, masked_phone,
                    encryption_key_version, bound_at, updated_at
                ) VALUES (?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT (user_id) DO UPDATE SET
                    phone_ciphertext = EXCLUDED.phone_ciphertext,
                    phone_query_digest = EXCLUDED.phone_query_digest,
                    masked_phone = EXCLUDED.masked_phone,
                    encryption_key_version = EXCLUDED.encryption_key_version,
                    updated_at = EXCLUDED.updated_at
                """,
                userId,
                phone.ciphertext(),
                phone.queryDigest(),
                phone.maskedPhone(),
                now,
                now);
    }

    public void markLogin(UUID userId, OffsetDateTime now) {
        jdbcTemplate.update(
                "UPDATE app_user SET last_login_at = ?, updated_at = ? WHERE id = ?",
                now,
                now,
                userId);
    }

    public void updateProfile(
            UUID userId,
            String displayName,
            OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE app_user
                SET display_name = COALESCE(?, display_name),
                    profile_onboarding_completed_at = COALESCE(profile_onboarding_completed_at, ?),
                    updated_at = ?,
                    lock_version = lock_version + 1
                WHERE id = ? AND deleted_at IS NULL AND status = 'ACTIVE'
                """, displayName, now, now, userId);
    }

    public void updateAvatar(UUID userId, UUID avatarMediaId, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE app_user
                SET avatar_media_id = ?, updated_at = ?, lock_version = lock_version + 1
                WHERE id = ? AND deleted_at IS NULL AND status = 'ACTIVE'
                """, avatarMediaId, now, userId);
    }

    public void completeProfileOnboarding(UUID userId, OffsetDateTime now) {
        jdbcTemplate.update("""
                UPDATE app_user
                SET profile_onboarding_completed_at = COALESCE(profile_onboarding_completed_at, ?),
                    updated_at = ?,
                    lock_version = lock_version + 1
                WHERE id = ? AND deleted_at IS NULL AND status = 'ACTIVE'
                """, now, now, userId);
    }

    public List<AppUserView> search(
            String keyword,
            AppUserStatus status,
            Boolean phoneBound,
            int limit,
            long offset) {
        String normalizedKeyword = keyword == null ? "" : keyword.strip().toLowerCase(Locale.ROOT);
        return jdbcTemplate.query("""
                SELECT %s
                FROM app_user u
                LEFT JOIN user_phone p ON p.user_id = u.id
                WHERE u.deleted_at IS NULL AND (? = ''
                       OR lower(COALESCE(u.display_name, '')) LIKE '%%' || ? || '%%'
                       OR lower(CAST(u.id AS text)) LIKE '%%' || ? || '%%'
                       OR lower(COALESCE(p.masked_phone, '')) LIKE '%%' || ? || '%%')
                  AND (CAST(? AS varchar) IS NULL OR u.status = ?)
                  AND (CAST(? AS boolean) IS NULL OR (p.user_id IS NOT NULL) = ?)
                ORDER BY u.registered_at DESC, u.id
                LIMIT ? OFFSET ?
                """.formatted(USER_COLUMNS),
                this::mapUser,
                normalizedKeyword,
                normalizedKeyword,
                normalizedKeyword,
                normalizedKeyword,
                status == null ? null : status.name(),
                status == null ? null : status.name(),
                phoneBound,
                phoneBound,
                limit,
                offset);
    }

    public long countSearch(String keyword, AppUserStatus status, Boolean phoneBound) {
        String normalizedKeyword = keyword == null ? "" : keyword.strip().toLowerCase(Locale.ROOT);
        Long count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM app_user u
                LEFT JOIN user_phone p ON p.user_id = u.id
                WHERE u.deleted_at IS NULL AND (? = ''
                       OR lower(COALESCE(u.display_name, '')) LIKE '%%' || ? || '%%'
                       OR lower(CAST(u.id AS text)) LIKE '%%' || ? || '%%'
                       OR lower(COALESCE(p.masked_phone, '')) LIKE '%%' || ? || '%%')
                  AND (CAST(? AS varchar) IS NULL OR u.status = ?)
                  AND (CAST(? AS boolean) IS NULL OR (p.user_id IS NOT NULL) = ?)
                """,
                Long.class,
                normalizedKeyword,
                normalizedKeyword,
                normalizedKeyword,
                normalizedKeyword,
                status == null ? null : status.name(),
                status == null ? null : status.name(),
                phoneBound,
                phoneBound);
        return count == null ? 0 : count;
    }

    private Optional<AppUserView> findOne(String sql, Object... parameters) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, this::mapUser, parameters));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private AppUserView mapUser(ResultSet resultSet, int rowNumber) throws SQLException {
        return new AppUserView(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("display_name"),
                resultSet.getObject("avatar_media_id", UUID.class),
                resultSet.getObject("profile_onboarding_completed_at", OffsetDateTime.class),
                AppUserStatus.valueOf(resultSet.getString("status")),
                resultSet.getObject("registered_at", OffsetDateTime.class),
                resultSet.getObject("last_login_at", OffsetDateTime.class),
                resultSet.getString("masked_phone"),
                resultSet.getBoolean("phone_bound"),
                resultSet.getBoolean("wechat_bound"),
                resultSet.getLong("lock_version"));
    }
}
