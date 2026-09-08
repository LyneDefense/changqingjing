package com.changqingjing.admin.auth;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AdminAccountRepository {

    private static final long ADMIN_CHANGE_LOCK = 675_009_143_211L;
    private static final String ACCOUNT_COLUMNS = """
            id, login_name, login_name_normalized, password_hash, display_name, role, status,
            password_changed_at, last_login_at, created_at, updated_at, lock_version
            """;

    private final JdbcTemplate jdbcTemplate;

    public AdminAccountRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<AdminAccount> findByNormalizedLoginName(String loginName) {
        return findOne(
                "SELECT " + ACCOUNT_COLUMNS + " FROM admin_account WHERE login_name_normalized = ?",
                loginName);
    }

    public Optional<AdminAccount> findById(UUID id) {
        return findOne("SELECT " + ACCOUNT_COLUMNS + " FROM admin_account WHERE id = ?", id);
    }

    public void insert(AdminAccount account) {
        jdbcTemplate.update("""
                INSERT INTO admin_account (
                    id, login_name, login_name_normalized, password_hash, display_name, role, status,
                    password_changed_at, last_login_at, created_at, updated_at, lock_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                account.id(),
                account.loginName(),
                account.loginNameNormalized(),
                account.passwordHash(),
                account.displayName(),
                account.role().name(),
                account.status().name(),
                account.passwordChangedAt(),
                account.lastLoginAt(),
                account.createdAt(),
                account.updatedAt(),
                account.lockVersion());
    }

    public void markLoginSucceeded(UUID id, OffsetDateTime loggedInAt) {
        jdbcTemplate.update(
                "UPDATE admin_account SET last_login_at = ?, updated_at = ? WHERE id = ?",
                loggedInAt,
                loggedInAt,
                id);
    }

    public long countAccounts() {
        Long result = jdbcTemplate.queryForObject("SELECT count(*) FROM admin_account", Long.class);
        return result == null ? 0 : result;
    }

    public void lockAdminChanges() {
        jdbcTemplate.queryForObject(
                "SELECT pg_advisory_xact_lock(?)",
                (resultSet, rowNumber) -> Boolean.TRUE,
                ADMIN_CHANGE_LOCK);
    }

    public void deleteSessions(String normalizedLoginName) {
        jdbcTemplate.update(
                "DELETE FROM spring_session WHERE principal_name = ?",
                normalizedLoginName);
    }

    private Optional<AdminAccount> findOne(String sql, Object parameter) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, this::mapAccount, parameter));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private AdminAccount mapAccount(ResultSet rows, int rowNumber) throws SQLException {
        return new AdminAccount(
                rows.getObject("id", UUID.class),
                rows.getString("login_name"),
                rows.getString("login_name_normalized"),
                rows.getString("password_hash"),
                rows.getString("display_name"),
                AdminRole.valueOf(rows.getString("role")),
                AdminStatus.valueOf(rows.getString("status")),
                rows.getObject("password_changed_at", OffsetDateTime.class),
                rows.getObject("last_login_at", OffsetDateTime.class),
                rows.getObject("created_at", OffsetDateTime.class),
                rows.getObject("updated_at", OffsetDateTime.class),
                rows.getLong("lock_version"));
    }
}
