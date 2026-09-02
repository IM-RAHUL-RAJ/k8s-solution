package com.capstone.etp.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Assumption: updateAveragePrice(qty, price) is a buy-side top-up -
 * recalculates the average across the old holding and the new units, same
 * asymmetric rule as the original brief's Position.applyBuy(). The diagram
 * doesn't show a sell-side method, so a sell/reduction path isn't tested
 * here - flag that gap if PortfolioHolding is meant to support selling.
 */
class PortfolioHoldingTest {

    @Test
    void createPortfolioHoldingReturnsGeneratedId() {
        PortfolioHolding holding = new PortfolioHolding(null, 1L, 10L, 0, BigDecimal.ZERO);
        Long id = holding.createPortfolioHolding(10L, 5);
        assertNotNull(id);
    }

    @Test
    void updateAveragePriceRecalculatesAcrossOldAndNewUnits() {
        PortfolioHolding holding = new PortfolioHolding(1L, 1L, 10L, 10, new BigDecimal("20.00"));
        boolean updated = holding.updateAveragePrice(10, new BigDecimal("30.00"));

        assertTrue(updated);
        assertEquals(20, holding.getQuantity());
        // (10*20.00 + 10*30.00) / 20 = 25.00
        assertEquals(new BigDecimal("25.00"), holding.getAvgPrice());
    }

    @Test
    void updateAveragePriceOnEmptyHoldingSetsPriceDirectly() {
        PortfolioHolding holding = new PortfolioHolding(1L, 1L, 10L, 0, BigDecimal.ZERO);
        holding.updateAveragePrice(5, new BigDecimal("40.00"));

        assertEquals(5, holding.getQuantity());
        assertEquals(new BigDecimal("40.00"), holding.getAvgPrice());
    }
}
