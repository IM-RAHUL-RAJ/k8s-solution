package com.capstone.etp.preferences;

import java.util.Optional;

// Defines the in-process contract for resolving a customer's preferred notification channel, including defaults and failure handling.
public interface ChannelResolver {

    Optional<ResolvedChannel> resolve(long accountId);
}