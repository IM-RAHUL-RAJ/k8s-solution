package com.capstone.etp.executor.poller;

import com.capstone.etp.executor.client.FauxnanceClient;
import com.capstone.etp.executor.kafka.models.KafkaMessageEnvelope;
import com.capstone.etp.executor.kafka.models.QuotePayload;
import com.capstone.etp.executor.mapper.ExecutorOrderMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Polls Fauxnance for live quotes and publishes each as a {@code QUOTE} message
 * to the {@code market-data} topic, keyed by symbol.
 *
 * <p>The batch endpoint accepts at most 25 symbols per request so large symbol
 * lists are chunked automatically.  Fauxnance failures are logged and skipped —
 * a missing poll cycle does not crash the executor.
 *
 * <p>Interval: {@code POLL_INTERVAL_SECONDS} env-var (default 60 s via
 * {@code app.poller.interval-seconds}).  The annotation expression multiplies
 * by 1000 to convert to milliseconds.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MarketDataPoller {

    private static final int MAX_BATCH_SIZE = 25;
    private static final String EVENT_TYPE  = "QUOTE";
    private static final String SOURCE      = "trade-executor";
    private static final int    SCHEMA_VER  = 1;

    private final ExecutorOrderMapper mapper;
    private final FauxnanceClient fauxnanceClient;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.topics.market-data:market-data}")
    private String marketDataTopic;

    /**
     * Spring EL multiplies the interval-seconds property by 1000 to get ms.
     * fixedDelay = time between end of last execution and start of next,
     * which avoids pile-up when a poll takes longer than the interval.
     */
    @Scheduled(fixedDelayString = "#{${app.poller.interval-seconds:60} * 1000}")
    public void poll() {
        List<String> symbols = mapper.findAllTradableSymbols();
        if (symbols.isEmpty()) {
            log.debug("No tradable instruments found — skipping poll");
            return;
        }

        log.debug("Polling {} symbol(s) from Fauxnance", symbols.size());

        // Chunk into batches of at most MAX_BATCH_SIZE
        for (int start = 0; start < symbols.size(); start += MAX_BATCH_SIZE) {
            int end   = Math.min(start + MAX_BATCH_SIZE, symbols.size());
            List<String> batch = symbols.subList(start, end);

            List<QuotePayload> quotes = fauxnanceClient.getBatchQuotes(batch);
            for (QuotePayload quote : quotes) {
                publishQuote(quote);
            }
        }
    }

    private void publishQuote(QuotePayload quote) {
        KafkaMessageEnvelope<QuotePayload> envelope = new KafkaMessageEnvelope<>(
                UUID.randomUUID(), EVENT_TYPE, Instant.now(), SOURCE, SCHEMA_VER, quote);
        try {
            String json = objectMapper.writeValueAsString(envelope);
            kafkaTemplate.send(marketDataTopic, quote.getSymbol(), json);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialise quote for {}: {}", quote.getSymbol(), e.getMessage());
        }
    }
}

