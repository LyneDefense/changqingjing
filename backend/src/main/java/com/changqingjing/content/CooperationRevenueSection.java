package com.changqingjing.content;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CooperationRevenueSection(
        @NotBlank(message = "收益分类名称不能为空")
        @Size(max = 80, message = "收益分类名称不能超过 80 个字符")
        String title,
        @NotBlank(message = "收益分类说明不能为空")
        @Size(max = 1_000, message = "收益分类说明不能超过 1000 个字符")
        String description,
        @NotBlank(message = "收益分类图标不能为空")
        @Size(max = 20, message = "收益分类图标不能超过 20 个字符")
        @Pattern(
                regexp = "cooperate|people|lodging|product|nature|service|blessing|scenic|tea|general",
                message = "请选择系统提供的收益分类图标")
        String icon,
        @Min(0) @Max(10_000) int displayOrder) {

    public CooperationRevenueSection normalized() {
        return new CooperationRevenueSection(
                title.strip(), description.strip(), icon.strip(), displayOrder);
    }
}
