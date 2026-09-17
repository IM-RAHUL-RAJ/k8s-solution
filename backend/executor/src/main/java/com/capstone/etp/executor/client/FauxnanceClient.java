package com.capstone.etp.executor.client;

import com.capstone.etp.executor.exception.RateLimitException;
import com.capstone.etp.executor.exception.PriceUnavailableException;
import com.capstone.etp.executor.exception.SymbolRequestException;
import com.capstone.etp.executor.exception.TransientNetworkException;
import com.capstone.etp.executor.kafka.models.QuotePayload;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;


@Slf4j
@Component
public class FauxnanceClient {

    private static final int HTTP_ACCEPTED = 202;
    private static final int HTTP_TOO_MANY_REQUESTS = 429;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final int maxAttempts;
    private final long initialBackoffMs;

    public FauxnanceClient(
            @Value("${app.fauxnance.base-url}") String baseUrl,
            @Value("${app.fauxnance.api-key}") String apiKey,
            @Value("${app.fauxnance.quote-retry.max-attempts:3}") int maxAttempts,
            @Value("${app.fauxnance.quote-retry.initial-backoff-ms:300}") long initialBackoffMs,
            ObjectMapper objectMapper) {
        this.maxAttempts = maxAttempts;
        this.initialBackoffMs = initialBackoffMs;
        this.objectMapper = objectMapper;

        log.info("========================================");
        log.info("FauxnanceClient INITIALIZED");
        log.info("Base URL: {}", baseUrl);
        log.info("Max attempts: {}", maxAttempts);
        log.info("Initial backoff: {} ms", initialBackoffMs);
        log.info("========================================");

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("X-API-Key", apiKey)
                .build();
    }


    // Fetches a single-symbol quote-used by the fill path.
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
                throw e;
            } catch (RestClientException e) {
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


    // Fetches up to 25 symbols in a single API call-used by the market-data poller.
    public List<QuotePayload> getBatchQuotes(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyList();
        }
        String symbolParam = String.join(",", symbols);
        String symbolSet = String.join(",", symbols);
        Exception lastError = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                ResponseEntity<String> response = restClient.get()
                        .uri("/quotes?symbols={symbols}", symbolParam)
                        .retrieve()
                        .toEntity(String.class);

                int statusCode = response.getStatusCode().value();
                if (statusCode == 200) {
                    return parseBatchQuoteResponse(response.getBody());
                }

                if (statusCode == HTTP_ACCEPTED) {
                    if (attempt == maxAttempts) {
                        throw new TransientNetworkException(symbolSet, attempt,
                                new RuntimeException("HTTP 202: market data is not ready"));
                    }
                    long delayMs = retryDelayMs(response.getHeaders(), attempt);
                    log.warn("Fauxnance batch not ready (202), attempt {}/{} retryInMs={}",
                            attempt, maxAttempts, delayMs);
                    sleep(delayMs);
                    continue;
                }

                if (statusCode == HTTP_TOO_MANY_REQUESTS) {
                    Integer retryAfterSeconds = retryAfterSeconds(response.getHeaders());
                    throw new RateLimitException(retryAfterSeconds);
                }

                if (statusCode >= 400 && statusCode < 500) {
                    throw new SymbolRequestException(symbolSet, statusCode, response.getBody());
                }

                if (statusCode >= 500 && statusCode < 600) {
                    if (attempt == maxAttempts) {
                        throw new TransientNetworkException(symbolSet, attempt,
                                new RuntimeException("HTTP " + statusCode));
                    }
                    long delayMs = retryDelayMs(response.getHeaders(), attempt);
                    log.warn("Fauxnance batch server error status={} attempt {}/{} retryInMs={}",
                            statusCode, attempt, maxAttempts, delayMs);
                    sleep(delayMs);
                    continue;
                }

                throw new SymbolRequestException(symbolSet, statusCode, response.getBody());
            } catch (RateLimitException | SymbolRequestException e) {
                throw e;
            } catch (TransientNetworkException e) {
                throw e;
            } catch (RestClientResponseException e) {
                lastError = e;
                int statusCode = e.getStatusCode().value();

                if (statusCode == HTTP_TOO_MANY_REQUESTS) {
                    throw new RateLimitException(retryAfterSeconds(e.getResponseHeaders()));
                }
                if (statusCode >= 400 && statusCode < 500) {
                    throw new SymbolRequestException(symbolSet, statusCode, e.getResponseBodyAsString());
                }

                if (statusCode >= 500 && statusCode < 600) {
                    if (attempt == maxAttempts) {
                        throw new TransientNetworkException(symbolSet, attempt, e);
                    }
                    long delayMs = retryDelayMs(e.getResponseHeaders(), attempt);
                    log.warn("Fauxnance batch HTTP error status={} attempt {}/{} retryInMs={}",
                            statusCode, attempt, maxAttempts, delayMs);
                    sleep(delayMs);
                    continue;
                }
                throw new SymbolRequestException(symbolSet, statusCode, e.getResponseBodyAsString());
            } catch (RestClientException e) {
                lastError = e;
                if (attempt == maxAttempts) {
                    throw new TransientNetworkException(symbolSet, attempt, e);
                }
                long delayMs = backoffMs(attempt);
                log.warn("Fauxnance batch network error attempt {}/{} retryInMs={} error={}",
                        attempt, maxAttempts, delayMs, e.getMessage());
                sleep(delayMs);
            } catch (RuntimeException e) {
                if (attempt == maxAttempts) {
                    throw new TransientNetworkException(symbolSet, attempt, e);
                }
                long delayMs = backoffMs(attempt);
                log.warn("Fauxnance batch parse/runtime error attempt {}/{} retryInMs={} error={}",
                        attempt, maxAttempts, delayMs, e.getMessage());
                sleep(delayMs);
            }
        }

        throw new TransientNetworkException(symbolSet, maxAttempts,
                lastError != null ? lastError : new RuntimeException("Request failed"));
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

    private List<QuotePayload> parseBatchQuoteResponse(String body) {
        if (body == null || body.isBlank()) {
            return Collections.emptyList();
        }

        try {
            JsonNode root = objectMapper.readTree(body);

            if (root.isArray()) {
                FauxnanceQuoteResponse[] responses = objectMapper.treeToValue(root, FauxnanceQuoteResponse[].class);
                if (responses == null) {
                    return Collections.emptyList();
                }
                return Arrays.stream(responses)
                        .map(this::toPayload)
                        .collect(Collectors.toList());
            }

            JsonNode quotes = root.path("data").path("quotes");
            if (!quotes.isArray()) {
                return Collections.emptyList();
            }

            return Arrays.stream(objectMapper.treeToValue(quotes, BatchQuoteEntry[].class))
                    .map(this::toPayload)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Fauxnance batch response", e);
        }
    }

    private QuotePayload toPayload(BatchQuoteEntry entry) {
        if (entry == null) {
            return null;
        }
        FauxnanceQuoteResponse quote = entry.quote != null ? entry.quote : new FauxnanceQuoteResponse();
        if (quote.getSymbol() == null || quote.getSymbol().isBlank()) {
            quote.setSymbol(entry.symbol);
        }
        quote.setStale(entry.stale);
        return toPayload(quote);
    }

    private long backoffMs(int attempt) {
        return initialBackoffMs * (1L << (attempt - 1));
    }

    private long retryDelayMs(HttpHeaders headers, int attempt) {
        Integer retryAfterSeconds = retryAfterSeconds(headers);
        if (retryAfterSeconds == null || retryAfterSeconds < 0) {
            return backoffMs(attempt);
        }
        return retryAfterSeconds * 1000L;
    }

    private Integer retryAfterSeconds(HttpHeaders headers) {
        if (headers == null) {
            return null;
        }
        String value = headers.getFirst("Retry-After");
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            log.warn("Invalid Retry-After header value='{}'", value);
            return null;
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static final class BatchQuoteEntry {
        public String symbol;
        public Boolean stale;
        public FauxnanceQuoteResponse quote;
    }
}

