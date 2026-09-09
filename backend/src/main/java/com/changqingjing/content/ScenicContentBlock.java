package com.changqingjing.content;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ScenicContentBlock(
        @NotNull CompanyBlockType type,
        @Size(max = 10_000) String text,
        UUID mediaId,
        @Size(max = 255) String altText) {

    public ScenicContentBlock normalized() {
        return new ScenicContentBlock(
                type,
                text == null ? null : text.strip(),
                mediaId,
                altText == null ? null : altText.strip());
    }
}
