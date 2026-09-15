package com.changqingjing.admin.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.changqingjing.admin.auth.AdminBootstrapService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"app.admin.password.bcrypt-strength=4", "app.media.cleanup.initial-delay-ms=3600000"})
@AutoConfigureMockMvc
@Testcontainers
class AdminAuditIntegrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired AdminBootstrapService bootstrap;
    @Autowired AdminAuditService audit;
    @Autowired AdminAuditSnapshot snapshots;
    UUID admin;
    @BeforeEach void reset() {
        jdbc.execute("TRUNCATE TABLE admin_account CASCADE");
        admin = bootstrap.createFirstAdmin("audit.admin", "日志管理员", "SecurePassword2026", "bootstrap-audit");
    }

    @Test void capturesCommittedDraftDiffsPreviewsFailuresAndLogoutWithoutDuplicatesOrSecrets() throws Exception {
        Session session = login("audit.admin", "SecurePassword2026");
        JsonNode created = body(write(session, "POST", "/api/v1/admin/product-categories",
                "{\"name\":\"测试分类\",\"displayOrder\":0,\"expectedVersion\":0}"));
        String id = created.path("id").asText();
        long version = created.path("version").asLong();
        write(session, "PUT", "/api/v1/admin/product-categories/" + id + "/draft",
                "{\"name\":\"新分类名称\",\"displayOrder\":2,\"expectedVersion\":" + version + "}");
        var saved = jdbc.queryForMap("SELECT * FROM admin_audit_event WHERE action = 'PRODUCT_CATEGORY_DRAFT_SAVE' ORDER BY created_at DESC LIMIT 1");
        assertThat(saved).containsEntry("client_ip", "198.51.100.24").containsEntry("actor_login_name", "audit.admin")
                .containsEntry("target_name", "新分类名称").containsEntry("affects_online", false);
        assertThat(saved.get("login_batch_id")).isNotNull();
        assertThat(saved.get("change_summary").toString()).contains("名称修改", "展示顺序调整");
        assertThat(count("PRODUCT_CATEGORY_DRAFT_SAVE")).isEqualTo(2);
        var published = write(session, "POST", "/api/v1/admin/product-categories/" + id + "/publish",
                "{\"expectedVersion\":" + (version + 1) + "}");
        assertThat(count("PRODUCT_CATEGORY_PUBLISH")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT affects_online FROM admin_audit_event WHERE action = 'PRODUCT_CATEGORY_PUBLISH'", Boolean.class)).isTrue();
        write(session, "POST", "/api/v1/admin/product-categories/" + id + "/unpublish",
                "{\"expectedVersion\":" + body(published).path("version").asLong() + "}");
        assertThat(count("PRODUCT_CATEGORY_UNPUBLISH")).isEqualTo(1);
        mvc.perform(put("/api/v1/admin/product-categories/" + id + "/draft").cookie(session.cookie())
                .header(session.header(), session.token()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"冲突提交\",\"displayOrder\":0,\"expectedVersion\":0}"))
                .andExpect(status().isConflict());
        assertThat(count("PRODUCT_CATEGORY_DRAFT_SAVE")).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT failure_code FROM admin_audit_event WHERE result = 'FAILURE' ORDER BY created_at DESC LIMIT 1", String.class))
                .isEqualTo("CONTENT_VERSION_CONFLICT");
        mvc.perform(get("/api/v1/admin/contents/cooperation/preview").cookie(session.cookie())).andExpect(status().isNotFound());
        assertThat(count("COOPERATION_PREVIEW")).isEqualTo(1);
        write(session, "POST", "/api/v1/admin/auth/logout", "{}");
        assertThat(count("ADMIN_LOGOUT")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT actor_id FROM admin_audit_event WHERE action = 'ADMIN_LOGOUT'", UUID.class)).isEqualTo(admin);
        assertThat(jdbc.queryForObject("SELECT string_agg(detail::text || COALESCE(change_summary::text, ''), ',') FROM admin_audit_event", String.class))
                .doesNotContain("SecurePassword2026", "sessionToken", "secretKey");
    }

    @Test void operatorCannotReadOtherAccountsLogsEvenByIdAndHistoricalMetadataRemainsUnknown() throws Exception {
        UUID operator = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO admin_account(id, login_name, login_name_normalized, password_hash, display_name,
                role, password_changed_at) SELECT ?, 'audit.operator', 'audit.operator', password_hash,
                '运营人员', 'OPERATOR', now() FROM admin_account WHERE id = ?
            """, operator, admin);
        UUID old = UUID.randomUUID();
        jdbc.update("INSERT INTO admin_audit_event(id,actor_id,action,target_type,result,trace_id) VALUES (?,?,'COMPANY_DRAFT_SAVE','CONTENT_ENTRY','SUCCESS','old-log')", old, admin);
        Session session = login("audit.operator", "SecurePassword2026");
        mvc.perform(get("/api/v1/admin/audit-events").cookie(session.cookie()).param("actor", "日志管理员"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0));
        mvc.perform(get("/api/v1/admin/audit-events/" + old).cookie(session.cookie())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/admin/audit-events").cookie(session.cookie())).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].actorId").value(operator.toString()));
        Session root = login("audit.admin", "SecurePassword2026");
        mvc.perform(get("/api/v1/admin/audit-events/" + old).cookie(root.cookie())).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.historical").value(true)).andExpect(jsonPath("$.data.clientIp").doesNotExist())
                .andExpect(jsonPath("$.data.changeSummary").isEmpty());
        mvc.perform(get("/api/v1/admin/audit-events").cookie(root.cookie()).param("module", "COMPANY").param("action", "DRAFT_SAVE"))
                .andExpect(jsonPath("$.data.total").value(1));
        mvc.perform(get("/api/v1/admin/audit-events").cookie(root.cookie()).param("pageSize", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/audit-events").cookie(root.cookie()).param("from", "2026-09-16").param("to", "2026-09-15"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/v1/admin/audit-events/" + old).cookie(root.cookie()).header(root.header(), root.token())).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/audit-events")).andExpect(status().isUnauthorized());
    }

    @Test void invalidCredentialsAndCsrfFailuresAreLoggedExactlyOnce() throws Exception {
        Session session = csrf(null);
        mvc.perform(post("/api/v1/admin/auth/login").cookie(session.cookie()).header(session.header(), session.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"loginName\":\"missing.user\",\"password\":\"WrongPassword2026\"}"))
                .andExpect(status().isUnauthorized());
        assertThat(count("ADMIN_LOGIN")).isEqualTo(1);
        assertThat(jdbc.queryForMap("SELECT actor_login_name, result, failure_code FROM admin_audit_event WHERE action = 'ADMIN_LOGIN'"))
                .containsEntry("actor_login_name", "missing.user").containsEntry("result", "FAILURE")
                .containsEntry("failure_code", "INVALID_CREDENTIALS");
        mvc.perform(post("/api/v1/admin/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        assertThat(count("ADMIN_LOGIN")).isEqualTo(2);
    }

    @Test void aBusinessFailureWithHttp200IsNeverReclassifiedAsSuccess() throws Exception {
        UUID mediaId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO media_asset(id,object_key,original_filename,media_type,content_type,size_bytes,
                purpose,status,uploaded_by,upload_expires_at,failure_code)
            VALUES (?,?,'invalid.jpg','IMAGE','image/jpeg',1,'PRODUCT_IMAGE','FAILED',?,now(),'MEDIA_HEADER_INVALID')
            """, mediaId, "test/" + mediaId, admin);
        var request = new org.springframework.mock.web.MockHttpServletRequest("POST", "/api/v1/admin/media/uploads/" + mediaId + "/complete");
        request.setAttribute(com.changqingjing.common.web.ApiTraceFilter.REQUEST_ATTRIBUTE, "business-failure-200");
        var response = new org.springframework.mock.web.MockHttpServletResponse();
        new AdminAuditFilter(audit, snapshots).doFilter(request, response, (req, res) -> {
            audit.recordFailure(admin, "MEDIA_UPLOAD_VERIFY", "MEDIA_ASSET", mediaId,
                    com.changqingjing.common.web.ApiTraceFilter.currentTraceId(request));
            response.setStatus(200);
        });
        assertThat(count("MEDIA_UPLOAD_VERIFY")).isEqualTo(1);
        assertThat(jdbc.queryForMap("SELECT result,failure_code FROM admin_audit_event WHERE action='MEDIA_UPLOAD_VERIFY'"))
                .containsEntry("result", "FAILURE").containsEntry("failure_code", "MEDIA_HEADER_INVALID");
    }

    long count(String action) { return jdbc.queryForObject("SELECT count(*) FROM admin_audit_event WHERE action = ?", Long.class, action); }
    JsonNode body(org.springframework.test.web.servlet.MvcResult result) throws Exception { return mapper.readTree(result.getResponse().getContentAsString()).path("data"); }
    Session login(String name, String password) throws Exception {
        Session anonymous = csrf(null);
        var result = write(anonymous, "POST", "/api/v1/admin/auth/login", mapper.writeValueAsString(java.util.Map.of("loginName", name, "password", password)));
        return csrf(result.getResponse().getCookie("SESSION"));
    }
    Session csrf(Cookie cookie) throws Exception {
        var request = get("/api/v1/admin/auth/csrf");
        if (cookie != null) request.cookie(cookie);
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        JsonNode data = body(result);
        Cookie updated = result.getResponse().getCookie("SESSION");
        return new Session(updated == null ? cookie : updated, data.path("headerName").asText(), data.path("token").asText());
    }
    org.springframework.test.web.servlet.MvcResult write(Session session, String method, String path, String json) throws Exception {
        return mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method), path).cookie(session.cookie())
                .header(session.header(), session.token()).header("User-Agent", "Mozilla/5.0 (Macintosh) Chrome/130.0")
                .with(req -> { req.setRemoteAddr("198.51.100.24"); return req; })
                .contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isOk()).andReturn();
    }
    record Session(Cookie cookie, String header, String token) {}
}
