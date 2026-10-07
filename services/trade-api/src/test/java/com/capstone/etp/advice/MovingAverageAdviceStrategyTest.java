package com.capstone.etp.advice;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MovingAverageAdviceStrategyTest {

    private static final Instant NOW = Instant.parse("2026-10-07T12:00:00Z");

    // short = 3, long = 6 keeps the arithmetic easy to follow
    private final MovingAverageAdviceStrategy strategy = new MovingAverageAdviceStrategy(3, 6);

    private static List<BigDecimal> closes(double... values) {
        List<BigDecimal> list = new ArrayList<>();
        for (double value : values) {
            list.add(BigDecimal.valueOf(value));
        }
        return list;
    }

    private static String reasoning(TradeAdvice advice) {
        return String.join(" | ", advice.reasoning());
    }

    @Test
    void buysWhenThePriceIsAboveTheShortAverageAndTheShortAverageIsAboveTheLongOne() {
        // short average (last 3) = 15, long average (last 6) = 11.5, latest 16 > 15
        TradeAdvice advice = strategy.evaluate("AAPL", closes(8, 9, 10, 14, 15, 16), NOW);

        assertEquals(AdviceSignal.BUY, advice.signal());
        assertEquals("AAPL", advice.symbol());
        assertEquals(NOW, advice.timestamp());
        String why = reasoning(advice);
        assertTrue(why.contains("Latest close 16.00 is above the 3-observation moving average 15.00"), why);
        assertTrue(why.contains("3-observation moving average 15.00 is above the 6-observation moving average 12.00"), why);
        assertTrue(why.contains("both positive"), why);
    }

    @Test
    void sellsWhenThePriceIsBelowTheShortAverageAndTheShortAverageIsBelowTheLongOne() {
        TradeAdvice advice = strategy.evaluate("AAPL", closes(20, 19, 18, 12, 11, 10), NOW);

        assertEquals(AdviceSignal.SELL, advice.signal());
        String why = reasoning(advice);
        assertTrue(why.contains("Latest close 10.00 is below the 3-observation moving average 11.00"), why);
        assertTrue(why.contains("is below the 6-observation moving average"), why);
        assertTrue(why.contains("both negative"), why);
    }

    @Test
    void holdsWhenTheTrendsDisagree() {
        // the long trend is up (short average above long), but the latest close dipped under the short average
        TradeAdvice advice = strategy.evaluate("AAPL", closes(8, 9, 10, 15, 16, 12), NOW);

        assertEquals(AdviceSignal.HOLD, advice.signal());
        String why = reasoning(advice);
        assertTrue(why.contains("is below the 3-observation moving average"), why);
        assertTrue(why.contains("neither the BUY nor the SELL condition is met"), why);
    }

    @Test
    void holdsOnAFlatMarket() {
        TradeAdvice advice = strategy.evaluate("AAPL", closes(10, 10, 10, 10, 10, 10), NOW);

        assertEquals(AdviceSignal.HOLD, advice.signal());
        assertTrue(reasoning(advice).contains("equal to"));
    }

    @Test
    void givesNoSignalWhenThereIsNotEnoughHistoryAndSaysHowMuchIsMissing() {
        TradeAdvice advice = strategy.evaluate("AAPL", closes(1, 2, 3, 4), NOW);

        assertEquals(AdviceSignal.INSUFFICIENT_DATA, advice.signal());
        assertEquals(List.of(
                "Signal unavailable: insufficient historical price data.",
                "Required: 6 observations.",
                "Available: 4."), advice.reasoning());
    }

    @Test
    void givesNoSignalWhenThereIsNoHistoryAtAll() {
        TradeAdvice advice = strategy.evaluate("AAPL", List.of(), NOW);

        assertEquals(AdviceSignal.INSUFFICIENT_DATA, advice.signal());
        assertTrue(reasoning(advice).contains("Available: 0."));
    }

    @Test
    void everySignalCarriesReasoning() {
        for (List<BigDecimal> history : List.of(closes(8, 9, 10, 14, 15, 16), closes(20, 19, 18, 12, 11, 10),
                closes(8, 9, 10, 15, 16, 12), closes(1))) {
            assertTrue(!strategy.evaluate("X", history, NOW).reasoning().isEmpty());
        }
    }

    @Test
    void refusesAShortPeriodThatIsNotBelowTheLongPeriod() {
        assertThrows(IllegalArgumentException.class, () -> new MovingAverageAdviceStrategy(5, 5));
        assertThrows(IllegalArgumentException.class, () -> new MovingAverageAdviceStrategy(0, 5));
    }
}
