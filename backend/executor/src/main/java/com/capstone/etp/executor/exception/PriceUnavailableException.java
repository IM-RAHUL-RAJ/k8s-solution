package com.capstone.etp.executor.exception;

/**
 * Thrown by FauxnanceClient when all retries are exhausted.
 * A price feed outage is a business outcome, not a message-processing failure:
 * the executor rejects the order with reason PRICE_UNAVAILABLE rather than
 * dead-lettering it, which would leave it at NEW for ever.
 */
public class PriceUnavailableException extends RuntimeException {
    public PriceUnavailableException(String message) {
        super(message);
    }
}

