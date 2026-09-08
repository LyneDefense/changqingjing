package com.changqingjing.content;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CompanyContentBlock(
        @NotNull CompanyBlockType type,
        @NotBlank @Size(max = 10_000) String text) {

    public CompanyContentBlock normalized() {
        return new CompanyContentBlock(type, text.strip());
    }
}
