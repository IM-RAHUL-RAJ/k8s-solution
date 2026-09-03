package com.capstone.etp.entity;

import org.junit.jupiter.api.Test;
import com.capstone.etp.enums.*;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Assumption: deposit()/withdraw() return a String transaction reference on
 * success. withdraw() throws when it would leave the balance negative,
 * matching "a debit is refused before anything is subtracted" from the
 * original Sprint 5 brief. Adjust once Account's real signature is settled.
 */
class AccountTest {

    private Account activeAccount(BigDecimal balance) {
        return Account.builder()
                .accountRef("ACC-REF-1")
                .accountType(AccountType.INDIAN_EQUITY)
                .currency("INR")
                .cashBalance(balance)
                .status(AccountStatus.ACTIVE)
                .version(0L)
                .build();
    }

    @Test
    void isActiveTrueWhenStatusActive() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        assertTrue(account.isActive());
    }

    @Test
    void suspendMakesAccountInactive() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        account.suspend();
        assertFalse(account.isActive());
        assertEquals(AccountStatus.SUSPENDED, account.getStatus());
    }

    @Test
    void closeMakesAccountInactive() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        account.close();
        assertFalse(account.isActive());
        assertEquals(AccountStatus.CLOSED, account.getStatus());
    }

    @Test
    void depositIncreasesBalanceAndReturnsReference() {
        Account account = activeAccount(new BigDecimal("100.00"));
        String reference = account.deposit(new BigDecimal("50.00"));
        assertEquals(new BigDecimal("150.00"), account.getCashBalance());
        assertNotNull(reference);
    }

    @Test
    void withdrawDecreasesBalanceAndReturnsReference() {
        Account account = activeAccount(new BigDecimal("100.00"));
        String reference = account.withdraw(new BigDecimal("40.00"));
        assertEquals(new BigDecimal("60.00"), account.getCashBalance());
        assertNotNull(reference);
    }

    @Test
    void withdrawRefusesToGoNegative() {
        Account account = activeAccount(new BigDecimal("50.00"));
        assertThrows(IllegalStateException.class, () -> account.withdraw(new BigDecimal("50.01")));
        assertEquals(new BigDecimal("50.00"), account.getCashBalance());
    }

    @Test
    void balanceDoesNotDriftOverManyOperations() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        for (int i = 0; i < 1000; i++) {
            account.withdraw(new BigDecimal("0.10"));
            account.deposit(new BigDecimal("0.10"));
        }
        assertEquals(new BigDecimal("1000.00"), account.getCashBalance());
    }
}
