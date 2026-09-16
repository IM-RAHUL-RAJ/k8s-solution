package com.capstone.etp.executor.pricing;

import com.capstone.etp.executor.domain.Quote;

public interface QuoteClient {
    Quote fetchQuote(String symbol);
}
