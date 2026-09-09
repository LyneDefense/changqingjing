package com.changqingjing.admin.user;

import com.changqingjing.admin.api.user.AdminAppUserQuery;
import com.changqingjing.admin.api.user.AdminAppUserResponse;
import com.changqingjing.app.user.AppUserRepository;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.common.api.PageResponse;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAppUserService {

    private final AppUserRepository repository;

    public AdminAppUserService(AppUserRepository repository) {
        this.repository = repository;
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
}
