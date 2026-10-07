package com.capstone.etp.automation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The most recent prices per symbol, kept in memory and bounded: when a symbol reaches its capacity the oldest
 * price is dropped. A quote that is not newer than the last one stored for that symbol is not a new observation
 * and is ignored, so a quote delivered twice cannot count as two ticks.
 */
public final class PriceHistory {

    private static final class Series {
        private final ArrayDeque<BigDecimal> prices = new ArrayDeque<>();
        private Instant lastAsOf;
    }

    private final int capacity;
    private final Map<String, Series> bySymbol = new ConcurrentHashMap<>();

    public PriceHistory(int capacity) {
        if (capacity < 2) {
            throw new IllegalArgumentException("capacity must be at least 2");
        }
        this.capacity = capacity;
    }

    /** @return true if this was a new observation and was stored */
    public boolean add(String symbol, BigDecimal price, Instant asOf) {
        Series series = bySymbol.computeIfAbsent(symbol, key -> new Series());
        synchronized (series) {
            if (asOf != null && series.lastAsOf != null && !asOf.isAfter(series.lastAsOf)) {
                return false;
            }
            if (series.prices.size() == capacity) {
                series.prices.removeFirst();
            }
            series.prices.addLast(price);
            if (asOf != null) {
                series.lastAsOf = asOf;
            }
            return true;
        }
    }

    /** A copy, oldest first. */
    public List<BigDecimal> snapshot(String symbol) {
        Series series = bySymbol.get(symbol);
        if (series == null) {
            return List.of();
        }
        synchronized (series) {
            return new ArrayList<>(series.prices);
        }
    }

    public int size(String symbol) {
        return snapshot(symbol).size();
    }
}
