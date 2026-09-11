package com.changqingjing.app.user;

import com.changqingjing.app.api.auth.AppUserResponse;
import com.changqingjing.app.api.profile.UpdateAppProfileRequest;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.media.MediaAssetRepository;
import com.changqingjing.media.MediaService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AppProfileService {

    private final AppUserRepository userRepository;
    private final MediaService mediaService;
    private final Clock clock = Clock.systemUTC();

    public AppProfileService(
            AppUserRepository userRepository,
            MediaService mediaService) {
        this.userRepository = userRepository;
        this.mediaService = mediaService;
    }

    @Transactional(readOnly = true)
    public AppUserResponse get(UUID userId) {
        return response(requiredUser(userId));
    }

    @Transactional
    public AppUserResponse update(
            UUID userId,
            UpdateAppProfileRequest request) {
        String displayName = normalizedDisplayName(request.displayName());
        userRepository.updateProfile(userId, displayName, now());
        return response(requiredUser(userId));
    }

    @Transactional
    public AppUserResponse skip(UUID userId) {
        userRepository.completeProfileOnboarding(userId, now());
        return response(requiredUser(userId));
    }

    @Transactional
    public AppUserResponse uploadAvatar(UUID userId, MultipartFile avatar) {
        MediaAssetRepository.Asset media = mediaService.storeAppAvatar(avatar, userId);
        userRepository.updateAvatar(userId, media.id(), now());
        return response(requiredUser(userId));
    }

    private String normalizedDisplayName(String displayName) {
        if (displayName == null) {
            return null;
        }
        String normalized = displayName.strip();
        if (normalized.isEmpty()) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "PROFILE_NAME_INVALID",
                    "昵称不能为空");
        }
        return normalized;
    }

    private AppUserResponse response(AppUserView user) {
        String avatarUrl = user.avatarMediaId() == null
                ? null
                : mediaService.signReadyMedia(user.avatarMediaId()).url();
        return AppUserResponse.from(user, avatarUrl);
    }

    private AppUserView requiredUser(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> new BusinessException(
                HttpStatus.UNAUTHORIZED,
                "UNAUTHENTICATED",
                "请重新登录"));
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
