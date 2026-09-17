package com.capstone.etp.executor.client;

import com.capstone.etp.executor.exception.PriceUnavailableException;
import com.capstone.etp.executor.kafka.models.QuotePayload;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * HTTP client for the Fauxnance price API.
 *
 * <p>The API key is injected exclusively from the {@code FAUXNANCE_API_KEY} environment
 * variable at runtime — it never appears in any properties file or Java constant.
 *
 * <p>Retries with exponential back-off (300 ms, 600 ms, 1 200 ms, …). When all
 * attempts are exhausted, throws {@link PriceUnavailableException} so the executor
 * can reject the order with reason {@code PRICE_UNAVAILABLE} rather than leaving
 * it at {@code NEW} indefinitely.
 */
@Slf4j
@Component
public class FauxnanceClient {

    private final RestClient restClient;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final int maxAttempts;
    private final long initialBackoffMs;

    public FauxnanceClient(
            @Value("${app.fauxnance.base-url}") String baseUrl,
            @Value("${FAUXNANCE_API_KEY}") String apiKey,
            @Value("${app.fauxnance.quote-retry.max-attempts:3}") int maxAttempts,
            @Value("${app.fauxnance.quote-retry.initial-backoff-ms:300}") long initialBackoffMs,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.maxAttempts = maxAttempts;
        this.initialBackoffMs = initialBackoffMs;
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("X-Api-Key", apiKey)
                .defaultHeader("x-api-key", apiKey)
                .messageConverters(converters -> {
                    converters.removeIf(c -> c instanceof org.springframework.http.converter.json.MappingJackson2HttpMessageConverter);
                    converters.add(new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(objectMapper));
                })
                .build();
    }

    /**
     * Fetches a single-symbol quote. Used by the fill path.
     *
     * @throws PriceUnavailableException if all retries are exhausted
     */
    public QuotePayload getQuote(String symbol) {
        Exception lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                FauxnanceQuoteResponse resp = restClient.get()
                        .uri("/quotes/{symbol}", symbol)
                        .retrieve()
                        .body(FauxnanceQuoteResponse.class);

                if (resp == null || resp.getAsk() == null || resp.getBid() == null) {
                    throw new PriceUnavailableException("Incomplete quote for " + symbol);
                }
                return toPayload(resp);
            } catch (PriceUnavailableException e) {
                throw e; // incomplete response — no point retrying
            } catch (Exception e) {
                lastError = e;
                log.warn("Fauxnance attempt {}/{} failed for symbol {}: {}",
                        attempt, maxAttempts, symbol, e.getMessage());
                if (attempt < maxAttempts) {
                    sleep(initialBackoffMs * (1L << (attempt - 1)));
                }
            }
        }
        throw new PriceUnavailableException(
                "Fauxnance unavailable after " + maxAttempts + " attempts for " + symbol
                + (lastError != null ? ": " + lastError.getMessage() : ""));
    }

    /**
     * Fetches quotes for the given symbols. Used by the market-data poller.
     * Tries batch first (supporting raw array, wrapped `data` array, or map);
     * if the endpoint returns an unexpected format or fails, falls back
     * to querying symbols individually.
     */
    public List<QuotePayload> getBatchQuotes(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyList();
        }
        String symbolParam = String.join(",", symbols);
        Exception lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String rawJson = restClient.get()
                        .uri("/quotes?symbols={symbols}", symbolParam)
                        .retrieve()
                        .body(String.class);

                if (rawJson != null && !rawJson.isBlank()) {
                    List<QuotePayload> parsed = parseBatchQuotesJson(rawJson);
                    if (!parsed.isEmpty()) {
                        return parsed;
                    }
                }
            } catch (Exception e) {
                lastError = e;
                log.warn("Fauxnance batch attempt {}/{} failed: {}", attempt, maxAttempts, e.getMessage());
                if (attempt < maxAttempts) {
                    sleep(initialBackoffMs * (1L << (attempt - 1)));
                }
            }
        }

        log.warn("Fauxnance batch endpoint failed ({}), falling back to individual symbol quotes...",
                lastError != null ? lastError.getMessage() : "empty");

        // Fallback: fetch symbols individually so the poller keeps working even if batch is not supported
        List<QuotePayload> individualQuotes = new java.util.ArrayList<>();
        for (String sym : symbols) {
            try {
                QuotePayload q = getQuote(sym);
                if (q != null) {
                    individualQuotes.add(q);
                }
            } catch (Exception e) {
                log.debug("Fallback quote for {} failed: {}", sym, e.getMessage());
            }
        }
        return individualQuotes;
    }

    private List<QuotePayload> parseBatchQuotesJson(String json) {
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(json);
            List<QuotePayload> results = new java.util.ArrayList<>();

            if (root.isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode node : root) {
                    FauxnanceQuoteResponse resp = objectMapper.treeToValue(node, FauxnanceQuoteResponse.class);
                    if (resp != null && resp.getSymbol() != null) {
                        results.add(toPayload(resp));
                    }
                }
            } else if (root.isObject()) {
                // Check if wrapped in "data" or "quotes"
                com.fasterxml.jackson.databind.JsonNode dataNode = root.has("data") ? root.get("data") : root.get("quotes");
                if (dataNode != null && dataNode.isArray()) {
                    for (com.fasterxml.jackson.databind.JsonNode node : dataNode) {
                        FauxnanceQuoteResponse resp = objectMapper.treeToValue(node, FauxnanceQuoteResponse.class);
                        if (resp != null && resp.getSymbol() != null) {
                            results.add(toPayload(resp));
                        }
                    }
                } else if (dataNode != null && dataNode.isObject()) {
                    // Could be single quote or map of symbol -> quote
                    if (dataNode.has("symbol")) {
                        FauxnanceQuoteResponse resp = objectMapper.treeToValue(root, FauxnanceQuoteResponse.class);
                        if (resp != null && resp.getSymbol() != null) {
                            results.add(toPayload(resp));
                        }
                    } else {
                        // Map of symbol -> quote
                        dataNode.fields().forEachRemaining(entry -> {
                            try {
                                FauxnanceQuoteResponse resp = objectMapper.treeToValue(entry.getValue(), FauxnanceQuoteResponse.class);
                                if (resp != null) {
                                    if (resp.getSymbol() == null) resp.setSymbol(entry.getKey());
                                    results.add(toPayload(resp));
                                }
                            } catch (Exception ignored) {}
                        });
                    }
                }
            }
            return results;
        } catch (Exception e) {
            log.warn("Failed to parse batch JSON response: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    // -------------------------------------------------------------------------

    private QuotePayload toPayload(FauxnanceQuoteResponse r) {
        QuotePayload q = new QuotePayload();
        q.setSymbol(r.getSymbol());
        q.setPrice(r.getPrice());
        q.setBid(r.getBid());
        q.setAsk(r.getAsk());
        q.setCurrency(r.getCurrency());
        q.setChange(r.getChange());
        q.setChangePercent(r.getChangePercent());
        q.setPreviousClose(r.getPreviousClose());
        q.setMarketState(r.getMarketState());
        q.setStale(r.getStale());
        q.setQuoteAsOf(r.getQuoteAsOf());
        return q;
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

