package com.changqingjing.admin.auth;

import com.changqingjing.common.api.BusinessException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AdminLoginAttemptLimiter {

    private static final int MAX_FAILURES = 5;
    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
    private static final Duration BLOCK_DURATION = Duration.ofMinutes(15);

    private final ConcurrentHashMap<String, AttemptState> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    public AdminLoginAttemptLimiter() {
        this(Clock.systemUTC());
    }

    AdminLoginAttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    public void checkAllowed(String remoteAddress, String normalizedLoginName) {
        AttemptState state = attempts.get(key(remoteAddress, normalizedLoginName));
        if (state != null && state.blockedUntil() != null && state.blockedUntil().isAfter(clock.instant())) {
            throw new BusinessException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "LOGIN_RATE_LIMITED",
                    "登录尝试过于频繁，请稍后再试");
        }
    }

    public void recordFailure(String remoteAddress, String normalizedLoginName) {
        String key = key(remoteAddress, normalizedLoginName);
        Instant now = clock.instant();
        attempts.compute(key, (ignored, current) -> {
            int failures = current == null || current.windowStartedAt().plus(FAILURE_WINDOW).isBefore(now)
                    ? 1
                    : current.failures() + 1;
            Instant windowStartedAt = failures == 1 ? now : current.windowStartedAt();
            Instant blockedUntil = failures >= MAX_FAILURES ? now.plus(BLOCK_DURATION) : null;
            return new AttemptState(failures, windowStartedAt, blockedUntil);
        });
    }

    public void recordSuccess(String remoteAddress, String normalizedLoginName) {
        attempts.remove(key(remoteAddress, normalizedLoginName));
    }

    void clear() {
        attempts.clear();
    }

    private String key(String remoteAddress, String normalizedLoginName) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] value = digest.digest(
                    (remoteAddress + '\n' + normalizedLoginName).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(value);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private record AttemptState(int failures, Instant windowStartedAt, Instant blockedUntil) {
    }
}
