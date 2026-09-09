package com.changqingjing.app.auth;

import java.time.OffsetDateTime;

public record IssuedAppSession(String rawToken, OffsetDateTime expiresAt) {
}
