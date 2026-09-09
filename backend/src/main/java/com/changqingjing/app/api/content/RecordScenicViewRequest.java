package com.changqingjing.app.api.content;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record RecordScenicViewRequest(@NotNull UUID viewId) {
}
