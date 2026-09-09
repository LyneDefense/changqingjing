package com.changqingjing.content;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CooperationValueSection(
        @NotBlank(message = "合作价值分类名称不能为空")
        @Size(max = 80, message = "合作价值分类名称不能超过 80 个字符")
        String title,
        @NotBlank(message = "合作价值说明不能为空")
        @Size(max = 5_000, message = "合作价值说明不能超过 5000 个字符")
        String description,
        UUID imageMediaId,
        @Size(max = 255, message = "图片说明不能超过 255 个字符")
        String imageAltText,
        @Min(0) @Max(10_000) int displayOrder) {

    public CooperationValueSection normalized() {
        return new CooperationValueSection(
                title.strip(),
                description.strip(),
                imageMediaId,
                imageAltText == null ? null : imageAltText.strip(),
                displayOrder);
    }
}
