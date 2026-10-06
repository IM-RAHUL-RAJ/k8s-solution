package com.capstone.etp.alerts;

import com.capstone.etp.dto.MarketQuote;
import com.capstone.etp.kafka.consumer.QuoteObserver;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Locale;


@Slf4j
@Component
class AlertEvaluator implements QuoteObserver {

    private final AlertIndex index;
    private final AlertMapper mapper;
    private final AlertHandover handover;

    AlertEvaluator(AlertIndex index, AlertMapper mapper, AlertHandover handover) {
        this.index = index;
        this.mapper = mapper;
        this.handover = handover;
    }

    @Override
    public void onQuote(MarketQuote quote) {
        if (quote == null || quote.getSymbol() == null || quote.getPrice() == null) {
            return;
        }
        if (Boolean.TRUE.equals(quote.getStale())) {
            return;
        }
        String symbol = quote.getSymbol().trim().toUpperCase(Locale.ROOT);
        for (AlertIndex.Entry alert : index.forSymbol(symbol)) {
            if (alert.direction().isCrossedBy(quote.getPrice(), alert.threshold())) {
                fire(alert, quote);
            }
        }
    }

    private void fire(AlertIndex.Entry alert, MarketQuote quote) {
        int rows;
        try {
            rows = mapper.markTriggered(alert.id(), quote.getPrice());
        } catch (RuntimeException e) {
            // Stays in the index: the next quote past the level tries again.
            log.warn("[ALERTS] could not record trigger of alert {}: {}", alert.id(), e.getMessage());
            return;
        }
        index.remove(alert.symbol(), alert.id());
        if (rows == 0) {
            log.debug("[ALERTS] alert {} already handled elsewhere", alert.id());
            return;
        }
        log.info("[ALERTS] alert {} triggered on {} at {}", alert.id(), alert.symbol(), quote.getPrice());
        handover.handOver(alert.id(), alert.accountId(), alert.symbol(), alert.direction(),
                alert.threshold(), quote.getPrice(),
                quote.getQuoteAsOf() != null ? quote.getQuoteAsOf() : Instant.now());
    }
}
