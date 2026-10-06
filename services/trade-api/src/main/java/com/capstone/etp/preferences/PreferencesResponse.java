package com.capstone.etp.preferences;

import java.time.Instant;
import java.util.List;

//A customer's preferences as the settings screen shows them.
public record PreferencesResponse(
        Long accountId,
        Long defaultAccountId,
        AlertChannel alertChannel,
        String contactDetail,
        ChannelSource source,
        List<ChannelOption> channels,
        Instant updatedAt) {

    /** One channel the customer could pick, and whether the profile can serve it. */
    public record ChannelOption(AlertChannel channel, boolean available, String hint) {
    }
}