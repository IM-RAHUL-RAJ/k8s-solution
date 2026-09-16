package com.capstone.etp.executor.exception;

/**
 * Thrown when a message cannot succeed on any retry (malformed JSON, unknown orderId,
 * unexpected eventType). The consumer sends it to the dead-letter topic on first attempt.
 */
public class DeadLetterException extends RuntimeException {
    public DeadLetterException(String reason) {
        super(reason);
    }
}

