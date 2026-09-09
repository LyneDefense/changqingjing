package com.changqingjing.admin.api.product;

import com.changqingjing.content.CompanyContentBlock;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record SaveProductDraftRequest(
        @NotBlank(message = "产品名称不能为空")
        @Size(max = 100, message = "产品名称不能超过 100 个字符")
        String name,
        @NotBlank(message = "简短介绍不能为空")
        @Size(max = 300, message = "简短介绍不能超过 300 个字符")
        String summary,
        UUID categoryId,
        UUID coverMediaId,
        @Size(max = 100, message = "详情内容不能超过 100 段")
        List<@Valid CompanyContentBlock> blocks,
        @Size(max = 2_000, message = "规格说明不能超过 2000 个字符")
        String specification,
        @Min(0) @Max(10_000) int displayOrder,
        @Min(0) long expectedVersion) {

    public SaveProductDraftRequest {
        blocks = blocks == null ? List.of() : List.copyOf(blocks);
    }
}
