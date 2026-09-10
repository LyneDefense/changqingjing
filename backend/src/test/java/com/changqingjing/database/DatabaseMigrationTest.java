package com.changqingjing.database;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Set;
import java.util.TreeSet;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class DatabaseMigrationTest {

    private static final Set<String> EXPECTED_TABLES = Set.of(
            "admin_account",
            "admin_audit_event",
            "app_session",
            "app_user",
            "content_entry",
            "content_revision",
            "content_revision_media",
            "flyway_schema_history",
            "media_asset",
            "map_selection",
            "scenic_stats",
            "scenic_view_receipt",
            "schema_marker",
            "spring_session",
            "spring_session_attributes",
            "user_phone",
            "wechat_api_credential",
            "wechat_identity");

    @Container
    private static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void appliesAllMigrationsOnceOnPostgreSql() throws Exception {
        Flyway flyway = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .load();

        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(6);
        assertThat(flyway.migrate().migrationsExecuted).isZero();

        Set<String> actualTables = new TreeSet<>();
        try (Connection connection = POSTGRES.createConnection("");
                Statement statement = connection.createStatement();
                ResultSet rows = statement.executeQuery("""
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                        """)) {
            while (rows.next()) {
                actualTables.add(rows.getString("table_name"));
            }
        }

        assertThat(actualTables).containsExactlyInAnyOrderElementsOf(EXPECTED_TABLES);
    }
}
