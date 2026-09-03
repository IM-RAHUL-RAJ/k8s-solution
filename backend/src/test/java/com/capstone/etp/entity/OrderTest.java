package com.capstone.etp.entity;

import com.capstone.etp.enums.OrderSide;
import com.capstone.etp.enums.OrderStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class OrderTest {

    private Order newOrder() {

        return Order.builder()
                .idempotencyKey("IDEMPOTENCY-KEY-01")
                .side(OrderSide.BUY)
                .quantity(10)
                .limitPrice(new BigDecimal("25.00"))
                .status(OrderStatus.NEW)
                .build();
    }

    @Test
    void orderStartsInNewStatus() {

        Order order = newOrder();

        assertEquals(
                OrderStatus.NEW,
                order.getStatus());
    }

    @Test
    void submitReturnsGeneratedId() {

        Order order = newOrder();

        Long id = order.submit();

        assertNotNull(id);
    }

    @Test
    void submitSetsCreatedAt() {

        Order order = newOrder();

        order.submit();

        assertNotNull(
                order.getCreatedAt());
    }

    @Test
    void cancelSucceedsWhileNew() {

        Order order = newOrder();

        assertTrue(
                order.cancel());

        assertEquals(
                OrderStatus.CANCELLED,
                order.getStatus());
    }

    @Test
    void cancelFailsOnceTerminal() {

        Order order = newOrder();

        order.cancel();

        assertThrows(
                IllegalStateException.class,
                order::cancel);
    }

    @Test
    void checkStatusReflectsTerminalState() {

        Order order = newOrder();

        order.cancel();

        assertTrue(
                order.checkStatus());
    }

    @Test
    void checkStatusFalseWhileStillNew() {

        Order order = newOrder();

        assertFalse(
                order.checkStatus());
    }
}