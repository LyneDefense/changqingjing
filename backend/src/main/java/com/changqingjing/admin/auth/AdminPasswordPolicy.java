package com.changqingjing.admin.auth;

import com.changqingjing.common.api.BusinessException;
import org.springframework.http.HttpStatus;

public final class AdminPasswordPolicy {

    public static final int MIN_LENGTH = 12;
    public static final int MAX_LENGTH = 128;

    private AdminPasswordPolicy() {
    }

    public static void validate(String password) {
        if (password == null
                || password.length() < MIN_LENGTH
                || password.length() > MAX_LENGTH
                || password.chars().noneMatch(Character::isLetter)
                || password.chars().noneMatch(Character::isDigit)) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "WEAK_PASSWORD",
                    "密码需为 12 至 128 位，并同时包含字母和数字");
        }
    }
}
