package com.capstone.etp.entity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Assumption: recalculateValue() sums (holding.quantity * holding.avgPrice)
 * across the portfolio's holdings, since currentValue isn't otherwise
 * derivable from this diagram alone.
 */
class PortfolioTest {

    Portfolio portfolio;

    @BeforeEach
    void createPortfolio() {
        portfolio = Portfolio.builder()
                .id(1L)
                .name("Growth Portfolio")
                .currentValue(new BigDecimal("0.00"))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .holdings(List.of())
                .build();
    }

    @Test
    void createPortfolioReturnsGeneratedId() {
        Long id = portfolio.createPortfolio();
        assertNotNull(id);
    }

    @Test
    void editPortfolioUpdatesNameAndReturnsTrue() {
        boolean edited = portfolio.editPortfolio("Balanced Portfolio");
        assertTrue(edited);
        assertEquals("Balanced Portfolio", portfolio.getName());
    }

    @Test
    void recalculateValueSumsHoldings() {
        Instrument instrument1 = Instrument.builder()
                .id(10L)
                .build();

        Instrument instrument2 = Instrument.builder()
                .id(20L)
                .build();

        PortfolioHolding holding1 = PortfolioHolding.builder()
                .id(1L)
                .portfolio(portfolio)
                .instrument(instrument1)
                .quantity(10)
                .avgPrice(new BigDecimal("25.00"))
                .build();

        PortfolioHolding holding2 = PortfolioHolding.builder()
                .id(2L)
                .portfolio(portfolio)
                .instrument(instrument2)
                .quantity(5)
                .avgPrice(new BigDecimal("100.00"))
                .build();

        portfolio.setHoldings(java.util.List.of(holding1, holding2));

        portfolio.recalculateValue();

        // 10 * 25.00 + 5 * 100.00 = 750.00
        assertEquals(new BigDecimal("750.00"), portfolio.getCurrentValue());
    }

    @Test
    void recalculateValueIsZeroWithNoHoldings() {
        portfolio.setHoldings(java.util.List.of());
        portfolio.recalculateValue();
        assertEquals(new BigDecimal("0.00"), portfolio.getCurrentValue());
    }
}
