package com.capstone.etp.executor.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecutionOrder {
    private UUID id;
    private Long accountId;
    private Long instrumentId;
    private String symbol;
    private OrderSide side;
    private int quantity;
    private BigDecimal limitPrice;
    private OrderStatus status;

    public boolean isNew() {
        return status == OrderStatus.NEW;
    }
}
