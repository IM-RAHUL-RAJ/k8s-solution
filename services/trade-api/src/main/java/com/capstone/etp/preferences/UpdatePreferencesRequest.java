package com.capstone.etp.preferences;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record UpdatePreferencesRequest(
        @NotNull @Positive Long defaultAccountId,
        @NotNull AlertChannel alertChannel) {
}