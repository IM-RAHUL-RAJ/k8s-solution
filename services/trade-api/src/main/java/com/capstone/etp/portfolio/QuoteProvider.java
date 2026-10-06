package com.capstone.etp.portfolio;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;


interface QuoteProvider {

    Map<String, ProviderQuote> fetch(List<String> symbols) throws QuoteProviderException;

    int MAX_BATCH = 25;

    record ProviderQuote(String symbol, BigDecimal price, String currency, Instant asOf, boolean stale) {
    }

    class QuoteProviderException extends Exception {
        QuoteProviderException(String message) {
            super(message);
        }

        QuoteProviderException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
