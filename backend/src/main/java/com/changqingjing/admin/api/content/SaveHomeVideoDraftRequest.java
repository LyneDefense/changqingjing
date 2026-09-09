package com.changqingjing.admin.api.content;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record SaveHomeVideoDraftRequest(
        @NotBlank @Size(max = 255) String title,
        @NotNull UUID videoMediaId,
        @NotNull UUID coverMediaId,
        @Min(0) long expectedVersion) {
}
