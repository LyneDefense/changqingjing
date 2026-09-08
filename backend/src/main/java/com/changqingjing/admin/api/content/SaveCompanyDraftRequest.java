package com.changqingjing.admin.api.content;

import com.changqingjing.content.CompanyContentBlock;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SaveCompanyDraftRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 2_000) String summary,
        @NotEmpty @Size(max = 100) List<@Valid CompanyContentBlock> blocks,
        @Min(0) long expectedVersion) {
}
