package com.changqingjing.admin.api.auth;

public record AdminCsrfResponse(String headerName, String parameterName, String token) {
}
