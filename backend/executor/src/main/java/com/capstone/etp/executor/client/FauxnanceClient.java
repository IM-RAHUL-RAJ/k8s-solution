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
    private final int maxAttempts;
    private final long initialBackoffMs;

    public FauxnanceClient(
            @Value("${app.fauxnance.base-url}") String baseUrl,
            @Value("${FAUXNANCE_API_KEY}") String apiKey,
            @Value("${app.fauxnance.quote-retry.max-attempts:3}") int maxAttempts,
            @Value("${app.fauxnance.quote-retry.initial-backoff-ms:300}") long initialBackoffMs,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
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
     * Tries batch first; if the endpoint returns an unexpected format, falls back
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
                FauxnanceQuoteResponse[] responses = restClient.get()
                        .uri("/quotes?symbols={symbols}", symbolParam)
                        .retrieve()
                        .body(FauxnanceQuoteResponse[].class);

                if (responses != null && responses.length > 0) {
                    return Arrays.stream(responses)
                            .filter(r -> r != null && r.getSymbol() != null)
                            .map(this::toPayload)
                            .collect(Collectors.toList());
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

