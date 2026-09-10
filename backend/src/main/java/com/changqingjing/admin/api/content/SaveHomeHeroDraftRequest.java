package com.changqingjing.admin.api.content;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record SaveHomeHeroDraftRequest(
        @Size(max = 100) String title,
        @Size(max = 200) String subtitle,
        @NotNull UUID coverMediaId,
        @Min(0) @Max(100) int focusX,
        @Min(0) @Max(100) int focusY,
        @Min(0) long expectedVersion) {
}
