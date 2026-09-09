package com.capstone.etp.exception;

public final class AccountAccessDeniedException extends ETPException {

    public AccountAccessDeniedException() {
        super("ACC-403", "Account not active");
    }
}
