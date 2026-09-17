package com.capstone.etp.executor.client;

import com.capstone.etp.executor.exception.PriceUnavailableException;
import com.capstone.etp.executor.kafka.models.QuotePayload;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * HTTP client for the Fauxnance price API.
 *
 * <p>The API key is injected exclusively from the {@code FAUXNANCE_API_KEY} environment
 * variable at runtime — it never appears in any properties file or Java constant.
 *
 * <p>Handles both wrapped {@code {"data": { ... }, "meta": { ... }}} responses and flat responses.
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
    private final ObjectMapper objectMapper;
    private final int maxAttempts;
    private final long initialBackoffMs;

    public FauxnanceClient(
            @Value("${app.fauxnance.base-url}") String baseUrl,
            @Value("${FAUXNANCE_API_KEY}") String apiKey,
            @Value("${app.fauxnance.quote-retry.max-attempts:3}") int maxAttempts,
            @Value("${app.fauxnance.quote-retry.initial-backoff-ms:300}") long initialBackoffMs,
            ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.maxAttempts = maxAttempts;
        this.initialBackoffMs = initialBackoffMs;
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("X-Api-Key", apiKey)
                .defaultHeader("x-api-key", apiKey)
                .messageConverters(converters -> {
                    converters.removeIf(c -> c instanceof MappingJackson2HttpMessageConverter);
                    converters.add(new MappingJackson2HttpMessageConverter(objectMapper));
                })
                .build();
    }

    /**
     * Fetches a single-symbol quote. Extracts the "data" portion of the response.
     *
     * @throws PriceUnavailableException if all retries are exhausted
     */
    public QuotePayload getQuote(String symbol) {
        Exception lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String rawJson = restClient.get()
                        .uri("/quotes/{symbol}", symbol)
                        .retrieve()
                        .body(String.class);

                if (rawJson == null || rawJson.isBlank()) {
                    throw new PriceUnavailableException("Empty response for " + symbol);
                }

                FauxnanceQuoteResponse resp = parseSingleQuote(rawJson);

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
     * Tries batch first; if the endpoint returns an error or unsupported format,
     * falls back to querying symbols individually.
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
                    List<QuotePayload> quotes = parseBatchQuotes(rawJson);
                    if (!quotes.isEmpty()) {
                        return quotes;
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

        // Fallback: query each symbol individually so market data poller continues to work
        List<QuotePayload> individualQuotes = new ArrayList<>();
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

    // -------------------------------------------------------------------------
    // Helper parsers: extracts "data" node and maps to FauxnanceQuoteResponse
    // -------------------------------------------------------------------------

    private FauxnanceQuoteResponse parseSingleQuote(String rawJson) throws Exception {
        JsonNode root = objectMapper.readTree(rawJson);
        JsonNode targetNode = root;
        Boolean isStale = null;

        // Check if there is a "meta" node containing "stale"
        if (root.has("meta") && root.get("meta").has("stale")) {
            isStale = root.get("meta").get("stale").asBoolean();
        }

        // Extract "data" if present
        if (root.has("data")) {
            targetNode = root.get("data");
        }

        FauxnanceQuoteResponse resp = objectMapper.treeToValue(targetNode, FauxnanceQuoteResponse.class);
        if (resp != null) {
            if (isStale != null) {
                resp.setStale(isStale);
            }
            // If "asOf" was present in targetNode and quoteAsOf wasn't mapped directly
            if (resp.getQuoteAsOf() == null && targetNode.has("asOf")) {
                try {
                    resp.setQuoteAsOf(Instant.parse(targetNode.get("asOf").asText()));
                } catch (Exception ignored) {}
            }
        }
        return resp;
    }

    private List<QuotePayload> parseBatchQuotes(String rawJson) {
        List<QuotePayload> list = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(rawJson);

            // Handle direct array: [ { "symbol": ... } ]
            if (root.isArray()) {
                for (JsonNode item : root) {
                    JsonNode quoteNode = item.has("data") ? item.get("data") : item;
                    FauxnanceQuoteResponse resp = objectMapper.treeToValue(quoteNode, FauxnanceQuoteResponse.class);
                    if (resp != null && resp.getSymbol() != null) {
                        list.add(toPayload(resp));
                    }
                }
                return list;
            }

            // Handle wrapped array: { "data": [ ... ] } or { "quotes": [ ... ] }
            JsonNode arrayNode = root.has("data") ? root.get("data") : root.get("quotes");
            if (arrayNode != null && arrayNode.isArray()) {
                for (JsonNode item : arrayNode) {
                    FauxnanceQuoteResponse resp = objectMapper.treeToValue(item, FauxnanceQuoteResponse.class);
                    if (resp != null && resp.getSymbol() != null) {
                        list.add(toPayload(resp));
                    }
                }
                return list;
            }

            // Handle single quote returned
            if (root.has("data") && root.get("data").has("symbol")) {
                FauxnanceQuoteResponse resp = objectMapper.treeToValue(root.get("data"), FauxnanceQuoteResponse.class);
                if (resp != null && resp.getSymbol() != null) {
                    list.add(toPayload(resp));
                }
                return list;
            }

            // Handle map of symbol -> quote: { "AAPL": { ... } } or { "data": { "AAPL": { ... } } }
            JsonNode mapNode = (arrayNode != null && arrayNode.isObject()) ? arrayNode : root;
            mapNode.fields().forEachRemaining(entry -> {
                try {
                    JsonNode node = entry.getValue();
                    if (node.isObject()) {
                        FauxnanceQuoteResponse resp = objectMapper.treeToValue(node, FauxnanceQuoteResponse.class);
                        if (resp != null) {
                            if (resp.getSymbol() == null) resp.setSymbol(entry.getKey());
                            list.add(toPayload(resp));
                        }
                    }
                } catch (Exception ignored) {}
            });

        } catch (Exception e) {
            log.warn("Failed to parse batch quotes JSON: {}", e.getMessage());
        }
        return list;
    }

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
