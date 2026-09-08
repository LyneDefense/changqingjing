package com.changqingjing.content;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CompanyContentBlock(
        @NotNull CompanyBlockType type,
        @Size(max = 10_000) String text,
        UUID mediaId,
        @Size(max = 255) String altText) {

    public CompanyContentBlock(CompanyBlockType type, String text) {
        this(type, text, null, null);
    }

    public CompanyContentBlock normalized() {
        return new CompanyContentBlock(
                type,
                text == null ? null : text.strip(),
                mediaId,
                altText == null ? null : altText.strip());
    }
}
