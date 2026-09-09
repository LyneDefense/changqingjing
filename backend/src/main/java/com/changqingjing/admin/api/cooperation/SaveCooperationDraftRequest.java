package com.changqingjing.admin.api.cooperation;

import com.changqingjing.content.CooperationRevenueSection;
import com.changqingjing.content.CooperationValueSection;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SaveCooperationDraftRequest(
        @NotBlank(message = "页面标题不能为空")
        @Size(max = 100, message = "页面标题不能超过 100 个字符")
        String title,
        @NotBlank(message = "页面简介不能为空")
        @Size(max = 500, message = "页面简介不能超过 500 个字符")
        String summary,
        @Size(max = 30, message = "收益分类不能超过 30 个")
        List<@Valid CooperationRevenueSection> revenueSections,
        @Size(max = 30, message = "合作价值分类不能超过 30 个")
        List<@Valid CooperationValueSection> valueSections,
        @Min(0) long expectedVersion) {

    public SaveCooperationDraftRequest {
        revenueSections = revenueSections == null ? List.of() : List.copyOf(revenueSections);
        valueSections = valueSections == null ? List.of() : List.copyOf(valueSections);
    }
}
