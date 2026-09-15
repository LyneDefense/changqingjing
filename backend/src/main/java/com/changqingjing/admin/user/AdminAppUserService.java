package com.changqingjing.admin.user;

import com.changqingjing.admin.api.user.AdminAppUserQuery;
import com.changqingjing.admin.api.user.AdminAppUserResponse;
import com.changqingjing.admin.api.user.UpdateAppUserStatusRequest;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.auth.AdminRole;
import com.changqingjing.app.user.AppUserRepository;
import com.changqingjing.app.user.AppUserView;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageResponse;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAppUserService {

    private final AppUserRepository repository;
    private final AdminAuditService auditService;

    public AdminAppUserService(AppUserRepository repository, AdminAuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminAppUserResponse> search(AdminAppUserQuery query) {
        return new PageResponse<>(
                repository.search(
                                query.getKeyword(),
                                query.getStatus(),
                                query.getPhoneBound(),
                                query.getPageSize(),
                                query.offset())
                        .stream()
                        .map(AdminAppUserResponse::from)
                        .toList(),
                query.getPage(),
                query.getPageSize(),
                repository.countSearch(
                        query.getKeyword(), query.getStatus(), query.getPhoneBound()));
    }

    @Transactional(readOnly = true)
    public AdminAppUserResponse get(UUID userId) {
        return repository.findById(userId)
                .map(AdminAppUserResponse::from)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "APP_USER_NOT_FOUND",
                        "注册用户不存在"));
    }

    @Transactional
    public AdminAppUserResponse changeStatus(
            UUID userId, UpdateAppUserStatusRequest request, AdminPrincipal actor, String traceId) {
        requireAdmin(actor);
        AppUserView current = lockCurrent(userId, request.expectedVersion());
        repository.changeStatus(userId, request.status(), OffsetDateTime.now(ZoneOffset.UTC));
        auditService.recordSuccess(actor.accountId(), "APP_USER_STATUS_UPDATE", "APP_USER", userId,
                traceId, Map.of("previousStatus", current.status().name(), "status", request.status().name()));
        return get(userId);
    }

    @Transactional
    public void delete(UUID userId, long expectedVersion, AdminPrincipal actor, String traceId) {
        requireAdmin(actor);
        lockCurrent(userId, expectedVersion);
        repository.deleteAccount(userId, OffsetDateTime.now(ZoneOffset.UTC));
        auditService.recordSuccess(actor.accountId(), "APP_USER_DELETE", "APP_USER", userId,
                traceId, Map.of());
    }

    private AppUserView lockCurrent(UUID userId, long expectedVersion) {
        AppUserView current = repository.lockById(userId).orElseThrow(() -> new BusinessException(
                HttpStatus.NOT_FOUND, "APP_USER_NOT_FOUND", "注册用户不存在"));
        if (current.lockVersion() != expectedVersion) {
            throw new BusinessException(HttpStatus.CONFLICT, "APP_USER_VERSION_CONFLICT",
                    "用户信息已变化，请刷新列表并重新确认后操作");
        }
        return current;
    }

    private void requireAdmin(AdminPrincipal actor) {
        if (actor == null || actor.role() != AdminRole.ADMIN) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "仅管理员可以管理注册用户");
        }
    }
}
