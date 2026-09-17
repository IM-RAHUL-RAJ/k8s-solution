package com.capstone.etp.executor.exception;

/**
 * Raised when Fauxnance returns HTTP 429 and the caller must stop sending
 * further requests for the current poll cycle.
 */
public class RateLimitException extends RuntimeException {

    private final Integer retryAfterSeconds;

    public RateLimitException(Integer retryAfterSeconds) {
        super("Fauxnance rate limit reached" +
                (retryAfterSeconds != null ? "; retry after " + retryAfterSeconds + "s" : ""));
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public Integer getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
