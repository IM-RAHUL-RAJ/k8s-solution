package com.capstone.etp.entity;

import com.capstone.etp.enums.TransactionStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Assumption: getHistory() is scoped to transactions for the same orderId
 * as the instance it's called on (there is no repository in this layer per
 * the original brief, so this is exercised against a supplied list rather
 * than a live lookup).
 */
class TransactionTest {
    Order order1 = Order.builder()
            .id(100L)
            .build();
    Order order2 = Order.builder()
            .id(999L)
            .build();

    @Test
    void newTransactionReportsItsStatus() {
        Transaction transaction = new Transaction(1L, order1, 10, new BigDecimal("25.00"),
                TransactionStatus.EXECUTED, LocalDateTime.now());
        assertEquals(TransactionStatus.EXECUTED, transaction.getStatus());
    }

    @Test
    void failedTransactionReportsFailedStatus() {
        Transaction transaction = new Transaction(2L, order1, 10, new BigDecimal("25.00"),
                TransactionStatus.FAILED, LocalDateTime.now());
        assertEquals(TransactionStatus.FAILED, transaction.getStatus());
    }

    @Test
    void historyReturnsOnlyTransactionsForSameOrder() {
        Transaction t1 = new Transaction(1L, order1, 10, new BigDecimal("25.00"),
                TransactionStatus.EXECUTED, LocalDateTime.now());
        Transaction t2 = new Transaction(2L, order1, 5, new BigDecimal("26.00"),
                TransactionStatus.EXECUTED, LocalDateTime.now());
        Transaction other = new Transaction(3L, order2, 1, new BigDecimal("1.00"),
                TransactionStatus.EXECUTED, LocalDateTime.now());

        List<Transaction> history = t1.getHistory(List.of(t1, t2, other));

        assertEquals(2, history.size());
        assertTrue(history.stream().allMatch(t -> t.getOrder().getId().equals(100L)));
    }
}
