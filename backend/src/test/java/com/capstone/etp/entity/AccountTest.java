package com.capstone.etp.entity;

import com.capstone.etp.entity.exception.InsufficientFundsException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccountTest {

    private Account activeAccount(BigDecimal balance) {
        return new Account(1L, "ACC-REF-1", "Ada Lovelace", "USD",
                AccountStatus.ACTIVE, balance, 0L);
    }

    @Test
    void isActiveTrueWhenStatusActive() {
        Account account = activeAccount(new BigDecimal("100.00"));
        assertTrue(account.isActive());
    }

    @Test
    void isActiveFalseWhenSuspended() {
        Account account = activeAccount(new BigDecimal("100.00"));
        account.suspend();
        assertFalse(account.isActive());
        assertEquals(AccountStatus.SUSPENDED, account.getStatus());
    }

    @Test
    void isActiveFalseWhenClosed() {
        Account account = activeAccount(new BigDecimal("100.00"));
        account.close();
        assertFalse(account.isActive());
        assertEquals(AccountStatus.CLOSED, account.getStatus());
    }

    @Test
    void closedAccountCanNeverReactivate() {
        Account account = activeAccount(new BigDecimal("100.00"));
        account.close();
        assertThrows(IllegalStateException.class, account::reactivate);
    }

    @Test
    void suspendedAccountCanReactivate() {
        Account account = activeAccount(new BigDecimal("100.00"));
        account.suspend();
        account.reactivate();
        assertTrue(account.isActive());
    }

    @Test
    void canAffordTrueWhenBalanceExactlyCoversAmount() {
        Account account = activeAccount(new BigDecimal("100.00"));
        assertTrue(account.canAfford(new BigDecimal("100.00")));
    }

    @Test
    void canAffordFalseWhenBalanceBelowAmount() {
        Account account = activeAccount(new BigDecimal("99.99"));
        assertFalse(account.canAfford(new BigDecimal("100.00")));
    }

    @Test
    void debitReducesBalance() {
        Account account = activeAccount(new BigDecimal("100.00"));
        account.debit(new BigDecimal("40.00"));
        assertEquals(new BigDecimal("60.00"), account.getBalance());
    }

    @Test
    void creditIncreasesBalance() {
        Account account = activeAccount(new BigDecimal("100.00"));
        account.credit(new BigDecimal("40.00"));
        assertEquals(new BigDecimal("140.00"), account.getBalance());
    }

    @Test
    void debitRefusesToGoNegativeBeforeSubtracting() {
        Account account = activeAccount(new BigDecimal("50.00"));
        assertThrows(InsufficientFundsException.class,
                () -> account.debit(new BigDecimal("50.01")));
        assertEquals(new BigDecimal("50.00"), account.getBalance());
    }

    @Test
    void debitRejectsNonPositiveAmount() {
        Account account = activeAccount(new BigDecimal("50.00"));
        assertThrows(IllegalArgumentException.class, () -> account.debit(BigDecimal.ZERO));
    }

    @Test
    void balanceDoesNotDriftOverManyOperations() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        for (int i = 0; i < 1000; i++) {
            account.debit(new BigDecimal("0.10"));
            account.credit(new BigDecimal("0.10"));
        }
        assertEquals(new BigDecimal("1000.00"), account.getBalance());
    }
}
