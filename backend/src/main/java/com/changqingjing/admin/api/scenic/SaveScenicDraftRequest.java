package com.changqingjing.admin.api.scenic;

import com.changqingjing.content.ScenicContentBlock;
import com.changqingjing.content.ScenicOpenStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record SaveScenicDraftRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 2_000) String summary,
        UUID coverMediaId,
        @Size(max = 100) List<@Valid ScenicContentBlock> blocks,
        @NotNull ScenicOpenStatus openStatus,
        @Min(0) @Max(10_000) int displayOrder,
        @Size(max = 255) String displayName,
        UUID locationSelectionId,
        @Min(0) long expectedVersion) {

    public SaveScenicDraftRequest {
        blocks = blocks == null ? List.of() : List.copyOf(blocks);
    }
}
