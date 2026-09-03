package com.capstone.etp.entity;

import com.capstone.etp.enums.OrderSide;
import com.capstone.etp.enums.OrderStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Assumption: submit() moves status from NEW into a working/accepted state
 * and returns the generated order id. cancel() only succeeds while NEW;
 * once terminal (FILLED/REJECTED/CANCELLED) it refuses, matching "reaches
 * exactly one terminal state, with a disallowed transition refused by the
 * order itself" from the original brief.
 */
class OrderTest {

    private Order newOrder() {
        return new Order(
                null,
                null,
                null,
                "IDEMPOTENCY-KEY-01",
                OrderSide.BUY,
                10,
                new BigDecimal("25.00"),
                OrderStatus.NEW,
                LocalDateTime.now(),
                null
        );
    }

    @Test
    void orderStartsInNewStatus() {
        Order order = newOrder();
        assertEquals(OrderStatus.NEW, order.getStatus());
    }

    @Test
    void submitReturnsGeneratedId() {
        Order order = newOrder();
        Long id = order.submit();
        assertNotNull(id);
    }

    @Test
    void cancelSucceedsWhileNew() {
        Order order = newOrder();
        assertTrue(order.cancel());
        assertEquals(OrderStatus.CANCELLED, order.getStatus());
    }

    @Test
    void cancelFailsOnceTerminal() {
        Order order = newOrder();
        order.cancel();
        assertThrows(IllegalStateException.class, order::cancel);
    }

    @Test
    void checkStatusReflectsTerminalState() {
        Order order = newOrder();
        order.cancel();
        assertTrue(order.checkStatus());
    }

    @Test
    void checkStatusFalseWhileStillNew() {
        Order order = newOrder();
        assertFalseIsNotTerminal(order);
    }

    private void assertFalseIsNotTerminal(Order order) {
        org.junit.jupiter.api.Assertions.assertFalse(order.checkStatus());
    }
}
