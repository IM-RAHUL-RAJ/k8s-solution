package com.capstone.etp.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PortfolioHoldingTest {

        Portfolio portfolio = new Portfolio(
                        1L,
                        null,
                        "Growth Portfolio",
                        BigDecimal.ZERO,
                        null,
                        null,
                        null);

        Instrument instrument = new Instrument(
                        10L,
                        "AAPL",
                        "NASDAQ",
                        "Apple Inc.",
                        null,
                        "USD",
                        true,
                        null);

        @Test
        void createPortfolioHoldingReturnsGeneratedId() {

                PortfolioHolding holding = new PortfolioHolding(
                                1L,
                                portfolio,
                                instrument,
                                10,
                                new BigDecimal("20.00"),
                                null);

                Long id = holding.createPortfolioHolding(
                                10L,
                                5);

                assertNotNull(id);
        }

        @Test
        void updateAveragePriceRecalculatesAcrossOldAndNewUnits() {

                PortfolioHolding holding = new PortfolioHolding(
                                1L,
                                portfolio,
                                instrument,
                                10,
                                new BigDecimal("20.00"),
                                null);

                boolean updated = holding.updateAveragePrice(
                                10,
                                new BigDecimal("30.00"));

                assertTrue(updated);

                assertEquals(
                                20,
                                holding.getQuantity());

                assertEquals(
                                new BigDecimal("25.00"),
                                holding.getAvgPrice());
        }

        @Test
        void updateAveragePriceOnEmptyHoldingSetsPriceDirectly() {

                PortfolioHolding holding = new PortfolioHolding(
                                1L,
                                portfolio,
                                instrument,
                                0,
                                BigDecimal.ZERO,
                                null);

                holding.updateAveragePrice(
                                5,
                                new BigDecimal("40.00"));

                assertEquals(
                                5,
                                holding.getQuantity());

                assertEquals(
                                new BigDecimal("40.00"),
                                holding.getAvgPrice());
        }
}