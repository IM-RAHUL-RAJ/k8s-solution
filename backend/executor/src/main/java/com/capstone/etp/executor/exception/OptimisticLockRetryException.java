package com.capstone.etp.executor.exception;

/**
 * Thrown inside a @Transactional settlement when the account optimistic lock fails
 * (another writer bumped the version between our read and our write).
 * Throwing an unchecked exception rolls back the entire settlement transaction,
 * so the outer retry loop in ExecutionService can re-read and re-attempt cleanly.
 */
public class OptimisticLockRetryException extends RuntimeException {
    public OptimisticLockRetryException(String message) {
        super(message);
    }
}

