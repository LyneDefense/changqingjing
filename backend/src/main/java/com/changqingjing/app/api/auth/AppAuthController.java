package com.changqingjing.app.api.auth;

import com.changqingjing.app.auth.AppPrincipal;
import com.changqingjing.app.auth.AppSessionService;
import com.changqingjing.app.user.AppLoginService;
import com.changqingjing.app.user.AppProfileService;
import com.changqingjing.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
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
    private final AppProfileService profileService;

    public AppAuthController(
            AppLoginService loginService,
            AppSessionService sessionService,
            AppProfileService profileService) {
        this.loginService = loginService;
        this.sessionService = sessionService;
        this.profileService = profileService;
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
        return ApiResponse.of(profileService.get(principal.userId()));
    }
}
