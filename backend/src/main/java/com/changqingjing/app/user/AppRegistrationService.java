package com.changqingjing.app.user;

import com.changqingjing.app.api.auth.AppLoginResponse;
import com.changqingjing.app.api.auth.AppUserResponse;
import com.changqingjing.app.auth.AppSessionService;
import com.changqingjing.app.auth.IssuedAppSession;
import com.changqingjing.app.wechat.WechatIdentityResult;
import com.changqingjing.app.wechat.WechatPhoneResult;
import com.changqingjing.common.api.BusinessException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppRegistrationService {

    private final AppUserRepository userRepository;
    private final PhoneProtector phoneProtector;
    private final AppSessionService sessionService;
    private final Clock clock = Clock.systemUTC();

    public AppRegistrationService(
            AppUserRepository userRepository,
            PhoneProtector phoneProtector,
            AppSessionService sessionService) {
        this.userRepository = userRepository;
        this.phoneProtector = phoneProtector;
        this.sessionService = sessionService;
    }

    @Transactional
    public AppLoginResponse restore(WechatIdentityResult identity) {
        OffsetDateTime now = now();
        AppUserView existing = userRepository
                .findByWechatIdentity(identity.appId(), identity.openid())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.CONFLICT,
                        "REGISTRATION_REQUIRED",
                        "该微信尚未注册，请先授权手机号登录"));
        requireActive(existing);
        userRepository.markWechatVerified(
                identity.appId(), identity.openid(), identity.unionid(), now);
        userRepository.markLogin(existing.id(), now);
        return issueResponse(existing.id(), now);
    }

    @Transactional
    public AppLoginResponse register(
            WechatIdentityResult identity,
            WechatPhoneResult phoneResult) {
        if (!identity.appId().equals(phoneResult.appId())) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "WECHAT_CREDENTIAL_MISMATCH",
                    "微信授权信息不匹配，请重新操作");
        }

        ProtectedPhone phone = phoneProtector.protect(phoneResult.phoneNumber());
        String digestLockKey = "phone:" + HexFormat.of().formatHex(phone.queryDigest());
        String identityLockKey = "wechat:" + identity.appId() + ":" + identity.openid();
        userRepository.lockRegistrationKeys(identityLockKey, digestLockKey);

        OffsetDateTime now = now();
        AppUserView existing = userRepository
                .findByWechatIdentity(identity.appId(), identity.openid())
                .orElse(null);
        UUID phoneOwner = userRepository.findPhoneOwner(phone.queryDigest()).orElse(null);

        UUID userId;
        if (existing == null) {
            if (phoneOwner != null) {
                throw phoneConflict();
            }
            userId = UUID.randomUUID();
            String displayName = "微信用户" + userId.toString().substring(0, 6).toUpperCase();
            userRepository.insertUser(userId, displayName, now);
            userRepository.insertWechatIdentity(
                    UUID.randomUUID(),
                    userId,
                    identity.appId(),
                    identity.openid(),
                    identity.unionid(),
                    now);
        } else {
            requireActive(existing);
            userId = existing.id();
            if (phoneOwner != null && !phoneOwner.equals(userId)) {
                throw phoneConflict();
            }
            userRepository.markWechatVerified(
                    identity.appId(), identity.openid(), identity.unionid(), now);
        }

        userRepository.upsertPhone(userId, phone, now);
        userRepository.markLogin(userId, now);
        return issueResponse(userId, now);
    }

    private AppLoginResponse issueResponse(UUID userId, OffsetDateTime now) {
        IssuedAppSession session = sessionService.issue(userId, now);
        AppUserView current = userRepository.findById(userId).orElseThrow();
        return new AppLoginResponse(
                session.rawToken(),
                session.expiresAt(),
                AppUserResponse.from(current));
    }

    private void requireActive(AppUserView user) {
        if (user.status() != AppUserStatus.ACTIVE) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "APP_ACCOUNT_DISABLED",
                    "当前账号不可用，请联系管理员");
        }
    }

    private BusinessException phoneConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "PHONE_ALREADY_BOUND",
                "该手机号已关联其他微信账号，暂不能自动合并");
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
