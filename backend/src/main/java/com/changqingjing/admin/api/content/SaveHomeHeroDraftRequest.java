package com.changqingjing.admin.api.content;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SaveHomeHeroDraftRequest(
        @NotNull UUID coverMediaId,
        @Min(0) long expectedVersion) {
}
