package com.capstone.etp.dto;

import com.capstone.etp.enums.OrderSide;
import com.capstone.etp.enums.OrderStatus;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderHistoryEntry {
    private String orderId;
    private Long accountId;
    private String symbol;
    private OrderSide side;
    private Integer quantity;
    private BigDecimal price;
    private OrderStatus status;
    private Instant createdOn;
    private BigDecimal executedPrice;
    private String idempotencyKey;
}