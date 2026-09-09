package com.changqingjing.app.user;

import com.changqingjing.app.wechat.WechatProperties;
import com.changqingjing.common.api.BusinessException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class PhoneProtector {

    private static final int IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final Pattern PHONE_PATTERN = Pattern.compile("\\+?[0-9]{6,20}");
    private static final byte[] DIGEST_CONTEXT =
            "changqingjing:user-phone:v1:".getBytes(StandardCharsets.UTF_8);

    private final SecretKeySpec encryptionKey;
    private final SecretKeySpec digestKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public PhoneProtector(WechatProperties properties) {
        String encodedKey = properties.getPhoneEncryptionKeyBase64();
        if (!StringUtils.hasText(encodedKey)) {
            this.encryptionKey = null;
            this.digestKey = null;
            return;
        }
        try {
            byte[] key = Base64.getDecoder().decode(encodedKey.strip());
            if (key.length != 32) {
                throw new IllegalArgumentException("Phone encryption key must contain 32 bytes");
            }
            this.encryptionKey = new SecretKeySpec(key, "AES");
            this.digestKey = new SecretKeySpec(key, "HmacSHA256");
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(
                    "APP_PHONE_ENCRYPTION_KEY_BASE64 must be Base64 for exactly 32 bytes",
                    exception);
        }
    }

    public ProtectedPhone protect(String rawPhone) {
        requireConfigured();
        String phone = normalize(rawPhone);
        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(phone.getBytes(StandardCharsets.UTF_8));
            byte[] ciphertext = ByteBuffer.allocate(iv.length + encrypted.length)
                    .put(iv)
                    .put(encrypted)
                    .array();

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(digestKey);
            mac.update(DIGEST_CONTEXT);
            byte[] digest = mac.doFinal(phone.getBytes(StandardCharsets.UTF_8));
            return new ProtectedPhone(ciphertext, digest, mask(phone));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to protect phone number", exception);
        }
    }

    private String normalize(String rawPhone) {
        String phone = rawPhone == null ? "" : rawPhone.replace(" ", "").replace("-", "");
        if (!PHONE_PATTERN.matcher(phone).matches()) {
            throw new BusinessException(
                    HttpStatus.BAD_GATEWAY,
                    "WECHAT_PHONE_INVALID",
                    "微信返回的手机号格式无效，请稍后重试");
        }
        return phone;
    }

    private String mask(String phone) {
        int visiblePrefix = phone.startsWith("+") ? Math.min(3, phone.length() - 4) : 3;
        return phone.substring(0, visiblePrefix)
                + "*".repeat(Math.max(4, phone.length() - visiblePrefix - 4))
                + phone.substring(phone.length() - 4);
    }

    private void requireConfigured() {
        if (encryptionKey == null || digestKey == null) {
            throw new BusinessException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "WECHAT_LOGIN_NOT_CONFIGURED",
                    "微信登录尚未配置，请联系管理员");
        }
    }
}
