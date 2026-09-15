package com.changqingjing.admin.api.scenic;

import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.ApiResponse;
import com.changqingjing.content.ScenicContentService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/map-selections")
public class AdminMapSelectionController {

    private final ScenicContentService scenicService;

    public AdminMapSelectionController(ScenicContentService scenicService) {
        this.scenicService = scenicService;
    }

    @PostMapping
    public ApiResponse<MapSelectionResponse> create(
            @Valid @RequestBody CreateMapSelectionRequest request,
            @AuthenticationPrincipal AdminPrincipal actor,
            jakarta.servlet.http.HttpServletRequest servletRequest) {
        MapSelectionResponse selection = scenicService.confirmMapSelection(request, actor);
        servletRequest.setAttribute("audit.targetId", selection.id());
        return ApiResponse.of(selection);
    }
}
