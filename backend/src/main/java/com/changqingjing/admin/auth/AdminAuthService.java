package com.changqingjing.admin.auth;

import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.common.api.BusinessException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuthService {

    private final AdminAccountRepository accountRepository;
    private final AdminAuditService auditService;
    private final AdminLoginAttemptLimiter attemptLimiter;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final String dummyPasswordHash;

    @Autowired
    public AdminAuthService(
            AdminAccountRepository accountRepository,
            AdminAuditService auditService,
            AdminLoginAttemptLimiter attemptLimiter,
            PasswordEncoder passwordEncoder) {
        this(accountRepository, auditService, attemptLimiter, passwordEncoder, Clock.systemUTC());
    }

    AdminAuthService(
            AdminAccountRepository accountRepository,
            AdminAuditService auditService,
            AdminLoginAttemptLimiter attemptLimiter,
            PasswordEncoder passwordEncoder,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.auditService = auditService;
        this.attemptLimiter = attemptLimiter;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AdminPrincipal login(
            String loginName,
            String password,
            String remoteAddress,
            String traceId) {
        String normalizedLoginName = normalizeLoginName(loginName);
        attemptLimiter.checkAllowed(remoteAddress, normalizedLoginName);
        AdminAccount account = accountRepository.findByNormalizedLoginName(normalizedLoginName).orElse(null);
        boolean passwordMatches = passwordEncoder.matches(
                password,
                account == null ? dummyPasswordHash : account.passwordHash());
        if (account == null || account.status() != AdminStatus.ACTIVE || !passwordMatches) {
            attemptLimiter.recordFailure(remoteAddress, normalizedLoginName);
            auditService.recordFailure(null, "ADMIN_LOGIN", "ADMIN_ACCOUNT", null, traceId);
            throw new BusinessException(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    "账号或密码不正确");
        }

        attemptLimiter.recordSuccess(remoteAddress, normalizedLoginName);
        OffsetDateTime loggedInAt = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        accountRepository.markLoginSucceeded(account.id(), loggedInAt);
        auditService.recordSuccess(
                account.id(),
                "ADMIN_LOGIN",
                "ADMIN_ACCOUNT",
                account.id(),
                traceId,
                Map.of());
        return new AdminPrincipal(
                account.id(),
                account.loginNameNormalized(),
                account.displayName(),
                account.role(),
                account.lockVersion(),
                clock.instant());
    }

    public static String normalizeLoginName(String loginName) {
        return loginName == null ? "" : loginName.strip().toLowerCase(Locale.ROOT);
    }
}
