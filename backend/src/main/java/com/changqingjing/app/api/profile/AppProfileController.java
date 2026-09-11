package com.changqingjing.app.api.profile;

import com.changqingjing.app.api.auth.AppUserResponse;
import com.changqingjing.app.auth.AppPrincipal;
import com.changqingjing.app.user.AppProfileService;
import com.changqingjing.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/app/me")
public class AppProfileController {

    private final AppProfileService profileService;

    public AppProfileController(AppProfileService profileService) {
        this.profileService = profileService;
    }

    @PatchMapping("/profile")
    @Operation(operationId = "updateAppProfile")
    public ApiResponse<AppUserResponse> update(
            @Valid @RequestBody UpdateAppProfileRequest request,
            @AuthenticationPrincipal AppPrincipal principal) {
        return ApiResponse.of(profileService.update(principal.userId(), request));
    }

    @PostMapping("/profile/skip")
    @Operation(operationId = "skipAppProfileSetup")
    public ApiResponse<AppUserResponse> skip(
            @AuthenticationPrincipal AppPrincipal principal) {
        return ApiResponse.of(profileService.skip(principal.userId()));
    }

    @PostMapping(path = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(operationId = "uploadAppAvatar")
    public ApiResponse<AppUserResponse> uploadAvatar(
            @RequestPart("avatar") MultipartFile avatar,
            @AuthenticationPrincipal AppPrincipal principal) {
        return ApiResponse.of(profileService.uploadAvatar(principal.userId(), avatar));
    }
}
