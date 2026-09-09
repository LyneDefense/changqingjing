package com.changqingjing.app.auth;

import com.changqingjing.app.wechat.WechatProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppSessionService implements AppTokenAuthenticator {

    private final AppSessionRepository repository;
    private final WechatProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Clock clock = Clock.systemUTC();

    public AppSessionService(AppSessionRepository repository, WechatProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    public IssuedAppSession issue(UUID userId, OffsetDateTime now) {
        byte[] tokenBytes = new byte[32];
        secureRandom.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        OffsetDateTime expiresAt = now.plus(properties.getSessionTtl());
        repository.insert(UUID.randomUUID(), digest(rawToken), userId, now, expiresAt);
        return new IssuedAppSession(rawToken, expiresAt);
    }

    @Override
    @Transactional
    public Optional<AppPrincipal> authenticate(String rawToken) {
        if (rawToken == null || rawToken.length() < 32 || rawToken.length() > 256) {
            return Optional.empty();
        }
        byte[] tokenDigest = digest(rawToken);
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        return repository.findActive(tokenDigest, now).map(session -> {
            repository.markSeen(tokenDigest, now);
            return new AppPrincipal(session.userId());
        });
    }

    private byte[] digest(String rawToken) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
