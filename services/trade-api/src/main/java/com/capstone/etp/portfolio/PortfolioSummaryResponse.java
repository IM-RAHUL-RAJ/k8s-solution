package com.capstone.etp.portfolio;

import java.math.BigDecimal;
import java.time.Instant;


public record PortfolioSummaryResponse(
        Long accountId,
        String baseCurrency,
        BigDecimal cashBalance,
        BigDecimal marketValue,
        BigDecimal costBasis,
        BigDecimal unrealisedPnl,
        BigDecimal unrealisedPnlPercent,
        BigDecimal realisedPnl,
        BigDecimal totalValue,
        int positionCount,
        boolean partial,
        Instant asOf) {
}
