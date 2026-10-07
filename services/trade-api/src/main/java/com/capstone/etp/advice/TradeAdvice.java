package com.capstone.etp.advice;

import java.time.Instant;
import java.util.List;

/** One piece of advice for one instrument. The reasoning lists the figures the rules actually used. */
public record TradeAdvice(String symbol, AdviceSignal signal, List<String> reasoning, Instant timestamp) {
}
