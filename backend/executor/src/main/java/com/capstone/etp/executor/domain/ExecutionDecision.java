package com.capstone.etp.executor.domain;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class ExecutionDecision {
    OrderStatus status;
    BigDecimal executionPrice;
    RejectionReason rejectionReason;

    public static ExecutionDecision filled(BigDecimal executionPrice) {
        return ExecutionDecision.builder()
                .status(OrderStatus.FILLED)
                .executionPrice(executionPrice)
                .build();
    }

    public static ExecutionDecision rejected(RejectionReason reason) {
        return ExecutionDecision.builder()
                .status(OrderStatus.REJECTED)
                .rejectionReason(reason)
                .build();
    }

    public boolean isFilled() {
        return status == OrderStatus.FILLED;
    }
}
