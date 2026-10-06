package com.capstone.etp.alerts;

import java.math.BigDecimal;
import java.time.Instant;


public record AlertResponse(
        Long id,
        String symbol,
        AlertDirection direction,
        BigDecimal threshold,
        AlertStatus status,
        DeliveryState deliveryState,
        BigDecimal triggeredPrice,
        Instant triggeredAt,
        Instant createdAt) {

    static AlertResponse from(PriceAlert alert) {
        return new AlertResponse(
                alert.getId(),
                alert.getSymbol(),
                alert.getDirection(),
                alert.getThreshold(),
                alert.getStatus(),
                alert.getDeliveryState(),
                alert.getTriggeredPrice(),
                alert.getTriggeredAt(),
                alert.getCreatedAt());
    }
}
