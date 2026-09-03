package com.capstone.etp.exception;

public final class AccountNotFoundException extends ETPException {

    private final Long accountId;

    public AccountNotFoundException(Long accountId) {
        super("ACC-404", "Account not found");
        this.accountId = accountId;
    }

    /** For server-side logging only - never put this in the message. */
    public Long getAccountId() {
        return accountId;
    }
}
