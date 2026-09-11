package com.changqingjing.common.web;

import com.changqingjing.common.api.ApiErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class ApiRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_SECONDS = 60;

    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong requestCounter = new AtomicLong();
    private final Policy appAuthentication;
    private final Policy adminLogin;
    private final Policy mediaUpload;
    private final Policy scenicView;

    @Autowired
    public ApiRateLimitFilter(
            ObjectMapper objectMapper,
            @Value("${app.security.rate-limit.app-auth-per-minute:30}") int appAuthLimit,
            @Value("${app.security.rate-limit.admin-login-per-minute:30}") int adminLoginLimit,
            @Value("${app.security.rate-limit.media-upload-per-minute:60}") int mediaUploadLimit,
            @Value("${app.security.rate-limit.scenic-view-per-minute:120}") int scenicViewLimit) {
        this(
                objectMapper,
                Clock.systemUTC(),
                appAuthLimit,
                adminLoginLimit,
                mediaUploadLimit,
                scenicViewLimit);
    }

    ApiRateLimitFilter(
            ObjectMapper objectMapper,
            Clock clock,
            int appAuthLimit,
            int adminLoginLimit,
            int mediaUploadLimit,
            int scenicViewLimit) {
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.appAuthentication = new Policy("app-auth", positive(appAuthLimit));
        this.adminLogin = new Policy("admin-login", positive(adminLoginLimit));
        this.mediaUpload = new Policy("media-upload", positive(mediaUploadLimit));
        this.scenicView = new Policy("scenic-view", positive(scenicViewLimit));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        Policy policy = policy(request);
        if (policy == null) {
            filterChain.doFilter(request, response);
            return;
        }

        long now = clock.instant().getEpochSecond();
        long windowStartedAt = now - Math.floorMod(now, WINDOW_SECONDS);
        String key = key(request.getRemoteAddr(), policy.name());
        Decision decision = consume(key, policy.limit(), windowStartedAt);
        response.setHeader("X-RateLimit-Limit", Integer.toString(policy.limit()));
        response.setHeader("X-RateLimit-Remaining", Integer.toString(decision.remaining()));

        if (decision.allowed()) {
            filterChain.doFilter(request, response);
            return;
        }

        long retryAfter = Math.max(1, windowStartedAt + WINDOW_SECONDS - now);
        response.setStatus(429);
        response.setHeader("Retry-After", Long.toString(retryAfter));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(
                response.getOutputStream(),
                ApiErrorResponse.of(
                        "RATE_LIMITED",
                        "请求过于频繁，请稍后再试",
                        ApiTraceFilter.currentTraceId(request)));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return policy(request) == null;
    }

    private Policy policy(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) {
            return null;
        }
        String path = request.getRequestURI();
        if (path.equals("/api/v1/admin/auth/login")) {
            return adminLogin;
        }
        if (path.equals("/api/v1/app/auth/wechat/session")
                || path.equals("/api/v1/app/auth/wechat/register-login")) {
            return appAuthentication;
        }
        if (path.equals("/api/v1/admin/media/uploads")
                || path.equals("/api/v1/app/me/avatar")) {
            return mediaUpload;
        }
        if (path.matches("/api/v1/app/scenics/[^/]+/views")) {
            return scenicView;
        }
        return null;
    }

    private Decision consume(String key, int limit, long windowStartedAt) {
        DecisionBox decision = new DecisionBox();
        windows.compute(key, (ignored, current) -> {
            int nextCount = current == null || current.startedAt() != windowStartedAt
                    ? 1
                    : current.count() + 1;
            decision.allowed = nextCount <= limit;
            decision.remaining = Math.max(0, limit - nextCount);
            return new Window(windowStartedAt, nextCount);
        });
        if ((requestCounter.incrementAndGet() & 255) == 0) {
            windows.entrySet().removeIf(entry -> entry.getValue().startedAt() < windowStartedAt);
        }
        return new Decision(decision.allowed, decision.remaining);
    }

    private String key(String remoteAddress, String policyName) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] value = digest.digest(
                    ((remoteAddress == null ? "unknown" : remoteAddress) + '\n' + policyName)
                            .getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(value);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static int positive(int value) {
        if (value <= 0) {
            throw new IllegalArgumentException("API rate limits must be positive");
        }
        return value;
    }

    private record Policy(String name, int limit) {
    }

    private record Window(long startedAt, int count) {
    }

    private record Decision(boolean allowed, int remaining) {
    }

    private static final class DecisionBox {
        private boolean allowed;
        private int remaining;
    }
}
