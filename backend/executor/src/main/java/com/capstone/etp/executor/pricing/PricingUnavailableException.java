package com.capstone.etp.executor.pricing;

public class PricingUnavailableException extends RuntimeException {
    public PricingUnavailableException(String message) {
        super(message);
    }

    public PricingUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
