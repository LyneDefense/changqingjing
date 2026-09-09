package com.changqingjing.app.auth;

import java.time.OffsetDateTime;
import java.util.UUID;

record AppSessionRecord(UUID userId, OffsetDateTime expiresAt) {
}
