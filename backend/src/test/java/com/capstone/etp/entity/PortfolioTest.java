package com.capstone.etp.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Assumption: recalculateValue() sums (holding.quantity * holding.avgPrice)
 * across the portfolio's holdings, since currentValue isn't otherwise
 * derivable from this diagram alone.
 */
class PortfolioTest {

    @Test
    void createPortfolioReturnsGeneratedId() {
        Portfolio portfolio = new Portfolio(null, 1L, "Growth Portfolio");
        Long id = portfolio.createPortfolio();
        assertNotNull(id);
    }

    @Test
    void editPortfolioUpdatesNameAndReturnsTrue() {
        Portfolio portfolio = new Portfolio(1L, 1L, "Growth Portfolio");
        boolean edited = portfolio.editPortfolio("Balanced Portfolio");
        assertTrue(edited);
        assertEquals("Balanced Portfolio", portfolio.getName());
    }

    @Test
    void recalculateValueSumsHoldings() {
        Portfolio portfolio = new Portfolio(1L, 1L, "Growth Portfolio");
        PortfolioHolding holding1 = new PortfolioHolding(1L, 1L, 10L, 10, new BigDecimal("25.00"));
        PortfolioHolding holding2 = new PortfolioHolding(2L, 1L, 20L, 5, new BigDecimal("100.00"));
        portfolio.setHoldings(java.util.List.of(holding1, holding2));

        portfolio.recalculateValue();

        // 10 * 25.00 + 5 * 100.00 = 750.00
        assertEquals(new BigDecimal("750.00"), portfolio.getCurrentValue());
    }

    @Test
    void recalculateValueIsZeroWithNoHoldings() {
        Portfolio portfolio = new Portfolio(1L, 1L, "Empty Portfolio");
        portfolio.setHoldings(java.util.List.of());
        portfolio.recalculateValue();
        assertEquals(new BigDecimal("0.00"), portfolio.getCurrentValue());
    }
}
