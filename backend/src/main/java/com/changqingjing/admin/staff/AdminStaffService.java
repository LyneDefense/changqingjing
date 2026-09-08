package com.changqingjing.admin.staff;

import com.changqingjing.admin.api.staff.AdminStaffQuery;
import com.changqingjing.admin.api.staff.AdminStaffResponse;
import com.changqingjing.admin.api.staff.CreateAdminStaffRequest;
import com.changqingjing.admin.api.staff.ResetAdminPasswordRequest;
import com.changqingjing.admin.api.staff.UpdateAdminStaffRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminAuthService;
import com.changqingjing.admin.auth.AdminPasswordPolicy;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.auth.AdminRole;
import com.changqingjing.admin.auth.AdminStatus;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageResponse;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminStaffService {

    private final AdminAccountRepository accountRepository;
    private final AdminAuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock = Clock.systemUTC();

    public AdminStaffService(
            AdminAccountRepository accountRepository,
            AdminAuditService auditService,
            PasswordEncoder passwordEncoder) {
        this.accountRepository = accountRepository;
        this.auditService = auditService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminStaffResponse> search(AdminStaffQuery query) {
        return new PageResponse<>(
                accountRepository.search(
                                query.getKeyword(),
                                query.getStatus(),
                                query.getPageSize(),
                                query.offset())
                        .stream()
                        .map(AdminStaffResponse::from)
                        .toList(),
                query.getPage(),
                query.getPageSize(),
                accountRepository.countSearch(query.getKeyword(), query.getStatus()));
    }

    @Transactional
    public AdminStaffResponse create(
            CreateAdminStaffRequest request,
            AdminPrincipal actor,
            String traceId) {
        AdminPasswordPolicy.validate(request.initialPassword());
        String normalizedLoginName = AdminAuthService.normalizeLoginName(request.loginName());
        OffsetDateTime now = now();
        AdminAccount account = new AdminAccount(
                UUID.randomUUID(),
                request.loginName().strip(),
                normalizedLoginName,
                passwordEncoder.encode(request.initialPassword()),
                request.displayName().strip(),
                request.role(),
                AdminStatus.ACTIVE,
                now,
                null,
                now,
                now,
                0);
        try {
            accountRepository.insert(account);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "LOGIN_NAME_CONFLICT",
                    "该登录账号已存在");
        }
        auditService.recordSuccess(
                actor.accountId(),
                "ADMIN_STAFF_CREATE",
                "ADMIN_ACCOUNT",
                account.id(),
                traceId,
                Map.of("role", account.role().name()));
        return AdminStaffResponse.from(account);
    }

    @Transactional
    public AdminStaffResponse update(
            UUID accountId,
            UpdateAdminStaffRequest request,
            AdminPrincipal actor,
            String traceId) {
        accountRepository.lockAdminChanges();
        AdminAccount current = findRequired(accountId);
        String displayName = request.displayName() == null
                ? current.displayName()
                : request.displayName().strip();
        AdminRole role = request.role() == null ? current.role() : request.role();
        AdminStatus status = request.status() == null ? current.status() : request.status();
        if (displayName.isEmpty()) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST, "INVALID_DISPLAY_NAME", "显示姓名不能为空");
        }
        boolean removesActiveAdmin = current.role() == AdminRole.ADMIN
                && current.status() == AdminStatus.ACTIVE
                && (role != AdminRole.ADMIN || status != AdminStatus.ACTIVE);
        if (removesActiveAdmin && accountRepository.countActiveAdmins() <= 1) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "LAST_ACTIVE_ADMIN",
                    "不能停用或降权最后一个有效管理员");
        }
        if (!accountRepository.update(
                accountId,
                displayName,
                role,
                status,
                request.expectedVersion(),
                now())) {
            throw versionConflict();
        }
        accountRepository.deleteSessions(current.loginNameNormalized());
        auditService.recordSuccess(
                actor.accountId(),
                "ADMIN_STAFF_UPDATE",
                "ADMIN_ACCOUNT",
                accountId,
                traceId,
                Map.of("role", role.name(), "status", status.name()));
        return AdminStaffResponse.from(findRequired(accountId));
    }

    @Transactional
    public AdminStaffResponse resetPassword(
            UUID accountId,
            ResetAdminPasswordRequest request,
            AdminPrincipal actor,
            String traceId) {
        AdminPasswordPolicy.validate(request.newPassword());
        AdminAccount current = findRequired(accountId);
        if (!accountRepository.resetPassword(
                accountId,
                passwordEncoder.encode(request.newPassword()),
                request.expectedVersion(),
                now())) {
            throw versionConflict();
        }
        accountRepository.deleteSessions(current.loginNameNormalized());
        auditService.recordSuccess(
                actor.accountId(),
                "ADMIN_STAFF_PASSWORD_RESET",
                "ADMIN_ACCOUNT",
                accountId,
                traceId,
                Map.of());
        return AdminStaffResponse.from(findRequired(accountId));
    }

    private AdminAccount findRequired(UUID accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "STAFF_NOT_FOUND",
                        "后台人员不存在"));
    }

    private BusinessException versionConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "STAFF_VERSION_CONFLICT",
                "人员信息已被其他管理员修改，请刷新后重试");
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
