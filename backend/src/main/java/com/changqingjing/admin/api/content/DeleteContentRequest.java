package com.changqingjing.admin.api.content;

import jakarta.validation.constraints.Min;

public record DeleteContentRequest(@Min(0) long expectedVersion) {
}
