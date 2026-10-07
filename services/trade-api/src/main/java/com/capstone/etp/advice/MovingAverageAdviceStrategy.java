package com.capstone.etp.advice;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Moving-average rules.
 * <pre>
 * short-term trend positive: latest close is above the short moving average
 * long-term trend positive:  the short moving average is above the long moving average
 *
 * BUY  : both trends positive
 * SELL : both trends negative (latest close below the short average, short average below the long average)
 * HOLD : enough data, but neither of the above
 * INSUFFICIENT_DATA : fewer than longPeriod closes
 * </pre>
 * The recent price movement (change over the short window) is reported for context; it does not decide the signal.
 */
@Component
public class MovingAverageAdviceStrategy implements AdviceStrategy {

    private final int shortPeriod;
    private final int longPeriod;

    public MovingAverageAdviceStrategy(@Value("${app.advice.short-period:10}") int shortPeriod,
                                       @Value("${app.advice.long-period:50}") int longPeriod) {
        if (shortPeriod < 1 || longPeriod <= shortPeriod) {
            throw new IllegalArgumentException("app.advice: short-period must be at least 1 and below long-period");
        }
        this.shortPeriod = shortPeriod;
        this.longPeriod = longPeriod;
    }

    @Override
    public int requiredObservations() {
        return longPeriod;
    }

    @Override
    public TradeAdvice evaluate(String symbol, List<BigDecimal> closes, Instant now) {
        int available = closes == null ? 0 : closes.size();
        if (available < longPeriod) {
            return new TradeAdvice(symbol, AdviceSignal.INSUFFICIENT_DATA, List.of(
                    "Signal unavailable: insufficient historical price data.",
                    "Required: " + longPeriod + " observations.",
                    "Available: " + available + "."), now);
        }

        BigDecimal price = closes.get(available - 1);
        BigDecimal shortAverage = average(closes, shortPeriod);
        BigDecimal longAverage = average(closes, longPeriod);
        boolean priceAbove = price.compareTo(shortAverage) > 0;
        boolean priceBelow = price.compareTo(shortAverage) < 0;
        boolean shortAbove = shortAverage.compareTo(longAverage) > 0;
        boolean shortBelow = shortAverage.compareTo(longAverage) < 0;

        List<String> reasoning = new ArrayList<>();
        reasoning.add("Latest close " + show(price) + " is " + relation(price, shortAverage) + " the "
                + shortPeriod + "-observation moving average " + show(shortAverage));
        reasoning.add("The " + shortPeriod + "-observation moving average " + show(shortAverage) + " is "
                + relation(shortAverage, longAverage) + " the " + longPeriod + "-observation moving average "
                + show(longAverage));
        BigDecimal start = closes.get(available - shortPeriod);
        if (start.signum() != 0) {
            BigDecimal movement = price.subtract(start).multiply(BigDecimal.valueOf(100))
                    .divide(start, 2, RoundingMode.HALF_UP);
            reasoning.add("Price moved " + (movement.signum() > 0 ? "+" : "") + movement.toPlainString()
                    + "% over the last " + shortPeriod + " observations (context only)");
        }

        AdviceSignal signal;
        if (priceAbove && shortAbove) {
            signal = AdviceSignal.BUY;
            reasoning.add("BUY: the short-term and the long-term trend are both positive");
        } else if (priceBelow && shortBelow) {
            signal = AdviceSignal.SELL;
            reasoning.add("SELL: the short-term and the long-term trend are both negative");
        } else {
            signal = AdviceSignal.HOLD;
            reasoning.add("HOLD: the trends do not agree, so neither the BUY nor the SELL condition is met");
        }
        return new TradeAdvice(symbol, signal, List.copyOf(reasoning), now);
    }

    private static BigDecimal average(List<BigDecimal> closes, int period) {
        BigDecimal sum = BigDecimal.ZERO;
        for (BigDecimal value : closes.subList(closes.size() - period, closes.size())) {
            sum = sum.add(value);
        }
        return sum.divide(BigDecimal.valueOf(period), MathContext.DECIMAL64);
    }

    private static String relation(BigDecimal left, BigDecimal right) {
        int compared = left.compareTo(right);
        return compared > 0 ? "above" : compared < 0 ? "below" : "equal to";
    }

    private static String show(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
