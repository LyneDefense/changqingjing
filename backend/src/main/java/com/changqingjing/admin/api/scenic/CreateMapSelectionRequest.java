package com.changqingjing.admin.api.scenic;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateMapSelectionRequest(
        @NotBlank @Size(max = 255) String providerName,
        @NotBlank @Size(max = 1_000) String providerAddress,
        @NotNull @DecimalMin("72") @DecimalMax("138") BigDecimal longitude,
        @NotNull @DecimalMin("0.8") @DecimalMax("56") BigDecimal latitude) {
}
