package com.changqingjing.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

public record ApiErrorResponse(
        String code,
        String message,
        String traceId,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<FieldViolation> violations) {

    public ApiErrorResponse {
        violations = violations == null ? List.of() : List.copyOf(violations);
    }

    public static ApiErrorResponse of(String code, String message, String traceId) {
        return new ApiErrorResponse(code, message, traceId, List.of());
    }
}
