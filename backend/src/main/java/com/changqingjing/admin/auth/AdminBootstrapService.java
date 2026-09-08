package com.changqingjing.admin.auth;

import com.changqingjing.admin.audit.AdminAuditService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminBootstrapService {

    private final AdminAccountRepository accountRepository;
    private final AdminAuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock = Clock.systemUTC();

    public AdminBootstrapService(
            AdminAccountRepository accountRepository,
            AdminAuditService auditService,
            PasswordEncoder passwordEncoder) {
        this.accountRepository = accountRepository;
        this.auditService = auditService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UUID createFirstAdmin(
            String loginName,
            String displayName,
            String password,
            String traceId) {
        String normalizedLoginName = AdminAuthService.normalizeLoginName(loginName);
        validateLoginName(normalizedLoginName);
        validateDisplayName(displayName);
        AdminPasswordPolicy.validate(password);
        accountRepository.lockAdminChanges();
        if (accountRepository.countAccounts() != 0) {
            throw new IllegalStateException("Administrator bootstrap has already been completed");
        }

        UUID accountId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        try {
            accountRepository.insert(new AdminAccount(
                    accountId,
                    loginName.strip(),
                    normalizedLoginName,
                    passwordEncoder.encode(password),
                    displayName.strip(),
                    AdminRole.ADMIN,
                    AdminStatus.ACTIVE,
                    now,
                    null,
                    now,
                    now,
                    0));
        } catch (DuplicateKeyException exception) {
            throw new IllegalStateException("Administrator bootstrap has already been completed", exception);
        }
        auditService.recordSuccess(
                null,
                "ADMIN_BOOTSTRAP",
                "ADMIN_ACCOUNT",
                accountId,
                traceId,
                Map.of("role", AdminRole.ADMIN.name()));
        return accountId;
    }

    private void validateLoginName(String loginName) {
        if (!loginName.matches("[a-z0-9][a-z0-9._-]{2,99}")) {
            throw new IllegalArgumentException(
                    "Bootstrap login must be 3-100 characters using letters, digits, dot, underscore or hyphen");
        }
    }

    private void validateDisplayName(String displayName) {
        if (displayName == null || displayName.strip().isEmpty() || displayName.strip().length() > 100) {
            throw new IllegalArgumentException("Bootstrap display name must be 1-100 characters");
        }
    }
}
