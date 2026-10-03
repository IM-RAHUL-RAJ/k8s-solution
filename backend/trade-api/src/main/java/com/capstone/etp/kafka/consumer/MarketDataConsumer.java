package com.capstone.etp.kafka.consumer;

import com.capstone.etp.dto.MarketQuote;
import com.capstone.etp.service.MarketQuoteCache;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Reads QUOTE events the executor publishes to the market-data topic and keeps the latest per
 * symbol, so the watchlist can show bid, ask and last without calling the quote provider itself.
 * A malformed message is logged and skipped; it must never stop the listener.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MarketDataConsumer {

    private final ObjectMapper objectMapper;
    private final MarketQuoteCache cache;

    @KafkaListener(
            topics = "${app.kafka.topics.market-data:market-data}",
            groupId = "${spring.kafka.consumer.group-id:trade-api-market-data}",
            autoStartup = "${app.market-data.consumer.enabled:true}")
    public void onMessage(String message) {
        try {
            JsonNode payload = objectMapper.readTree(message).get("payload");
            if (payload == null || payload.isNull()) {
                log.warn("market-data message without a payload, skipped");
                return;
            }
            cache.put(objectMapper.treeToValue(payload, MarketQuote.class));
        } catch (Exception e) {
            log.warn("Could not read a market-data message, skipped: {}", e.getMessage());
        }
    }
}
