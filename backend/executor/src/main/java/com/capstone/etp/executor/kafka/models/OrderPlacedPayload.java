package com.capstone.etp.executor.kafka.models;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Payload of an ORDER_PLACED message on the {@code orders} topic.
 * Field names must match the trade-api's OrderPlacedPayload exactly.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderPlacedPayload {

    private UUID orderId;

    private Long accountId;

    private String symbol;

    /** "BUY" or "SELL" */
    private String side;

    private Integer quantity;

    /** Limit price from the original order request. */
    private BigDecimal price;

    private String idempotencyKey;

    private Instant createdOn;
}

