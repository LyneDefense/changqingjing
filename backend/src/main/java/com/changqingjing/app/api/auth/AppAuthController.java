package com.changqingjing.app.api.auth;

import com.changqingjing.app.auth.AppPrincipal;
import com.changqingjing.app.auth.AppSessionService;
import com.changqingjing.app.user.AppLoginService;
import com.changqingjing.app.user.AppUserRepository;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.common.api.BusinessException;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app")
public class AppAuthController {

    private final AppLoginService loginService;
    private final AppSessionService sessionService;
    private final AppUserRepository userRepository;

    public AppAuthController(
            AppLoginService loginService,
            AppSessionService sessionService,
            AppUserRepository userRepository) {
        this.loginService = loginService;
        this.sessionService = sessionService;
        this.userRepository = userRepository;
    }

    @PostMapping("/auth/wechat/session")
    public ApiResponse<AppLoginResponse> restore(
            @Valid @RequestBody WechatSessionRequest request) {
        return ApiResponse.of(loginService.restore(request.loginCode()));
    }

    @PostMapping("/auth/wechat/register-login")
    public ApiResponse<AppLoginResponse> registerLogin(
            @Valid @RequestBody WechatRegisterLoginRequest request) {
        return ApiResponse.of(loginService.registerLogin(
                request.loginCode(), request.phoneCode()));
    }

    @PostMapping("/auth/logout")
    @Operation(operationId = "logoutAppSession")
    public ApiResponse<String> logout(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        sessionService.revoke(authorization.substring("Bearer ".length()).trim());
        return ApiResponse.of("logged-out");
    }

    @GetMapping("/me")
    public ApiResponse<AppUserResponse> me(@AuthenticationPrincipal AppPrincipal principal) {
        return ApiResponse.of(userRepository.findById(principal.userId())
                .map(AppUserResponse::from)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED,
                        "UNAUTHENTICATED",
                        "请重新登录")));
    }
}
