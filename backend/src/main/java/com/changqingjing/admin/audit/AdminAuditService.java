package com.changqingjing.admin.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuditService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public AdminAuditService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void recordSuccess(
            UUID actorId,
            String action,
            String targetType,
            UUID targetId,
            String traceId,
            Map<String, ?> detail) {
        record(actorId, action, targetType, targetId, "SUCCESS", traceId, detail);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(
            UUID actorId,
            String action,
            String targetType,
            UUID targetId,
            String traceId) {
        record(actorId, action, targetType, targetId, "FAILURE", traceId, Map.of());
    }

    private void record(
            UUID actorId,
            String action,
            String targetType,
            UUID targetId,
            String result,
            String traceId,
            Map<String, ?> detail) {
        jdbcTemplate.update("""
                INSERT INTO admin_audit_event (
                    id, actor_id, action, target_type, target_id, result, trace_id, detail
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                """,
                UUID.randomUUID(),
                actorId,
                action,
                targetType,
                targetId,
                result,
                traceId,
                toJson(detail));
    }

    private String toJson(Map<String, ?> detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Audit detail cannot be serialized", exception);
        }
    }
}
