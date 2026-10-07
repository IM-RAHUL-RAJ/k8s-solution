package com.capstone.etp.automation;

import com.capstone.etp.dto.MarketQuote;
import com.capstone.etp.dto.PlaceOrderRequest;
import com.capstone.etp.enums.OrderSide;
import com.capstone.etp.kafka.consumer.QuoteObserver;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.Executor;

/**
 * Runs the configured strategies against the real-time price stream (the market-data topic, via QuoteObserver) and
 * places an order through the Trade REST API when one triggers.
 *
 * <pre>
 * quote -> price history -> strategy -> trigger -> order request -> Trade REST API -> (existing order flow)
 * </pre>
 *
 * It never writes to the orders table and never publishes to the execution topic itself. Strategies are checked
 * when the service starts: a disabled or invalid one is left out and can never place an order.
 */
@Slf4j
public class AutomationService implements QuoteObserver {

    private static final int RECENT_RESULTS = 200;

    private record Active(StrategyDefinition definition, String symbol, TradingStrategy strategy) {
    }

    private final TradeApiClient tradeApi;
    private final Executor executor;
    private final Clock clock;
    private final PriceHistory history;
    private final Map<String, List<Active>> bySymbol = new HashMap<>();
    private final Deque<AutomationResult> recent = new ConcurrentLinkedDeque<>();

    public AutomationService(AutomationProperties properties, TradeApiClient tradeApi, Executor executor, Clock clock) {
        this.tradeApi = tradeApi;
        this.executor = executor;
        this.clock = clock;
        this.history = new PriceHistory(Math.max(properties.getHistorySize(), 10));
        for (StrategyDefinition definition : properties.getStrategies()) {
            register(definition, properties.getHistorySize());
        }
        log.info("[AUTOMATION] started strategies={}", bySymbol.values().stream().mapToInt(List::size).sum());
    }

    private void register(StrategyDefinition definition, int historySize) {
        String id = definition == null ? null : definition.getId();
        List<String> problems = StrategyDefinitionValidator.problems(definition);
        if (!problems.isEmpty()) {
            log.error("[AUTOMATION] strategy refused id={} problems={}", id, problems);
            return;
        }
        if (!definition.isEnabled()) {
            log.info("[AUTOMATION] strategy disabled id={}", id);
            return;
        }
        TradingStrategy strategy = StrategyFactory.create(definition);
        if (strategy.requiredObservations() > historySize) {
            log.error("[AUTOMATION] strategy refused id={} problems=[history-size {} is smaller than the {} observations it needs]",
                    id, historySize, strategy.requiredObservations());
            return;
        }
        String symbol = definition.getSymbol().trim().toUpperCase(Locale.ROOT);
        bySymbol.computeIfAbsent(symbol, key -> new ArrayList<>()).add(new Active(definition, symbol, strategy));
        log.info("[AUTOMATION] strategy active id={} strategy={} symbol={} accountId={} quantity={}",
                id, strategy.name(), symbol, definition.getAccountId(), definition.getQuantity());
    }

    @Override
    public void onQuote(MarketQuote quote) {
        if (quote == null || quote.getSymbol() == null || quote.getSymbol().isBlank()
                || quote.getPrice() == null || quote.getPrice().signum() <= 0) {
            log.warn("[AUTOMATION] malformed price event ignored");
            return;
        }
        String symbol = quote.getSymbol().trim().toUpperCase(Locale.ROOT);
        List<Active> strategies = bySymbol.get(symbol);
        if (strategies == null || strategies.isEmpty()) {
            return;
        }
        if (!history.add(symbol, quote.getPrice(), quote.getQuoteAsOf())) {
            log.debug("[AUTOMATION] price already seen, not a new observation symbol={}", symbol);
            return;
        }
        List<BigDecimal> prices = history.snapshot(symbol);
        for (Active active : strategies) {
            evaluate(active, prices, quote);
        }
    }

    /** What has happened lately, newest first. For logs, tests and a future status page. */
    public List<AutomationResult> recentResults() {
        return Collections.unmodifiableList(new ArrayList<>(recent));
    }

    private void evaluate(Active active, List<BigDecimal> prices, MarketQuote quote) {
        StrategyDefinition definition = active.definition();
        StrategySignal signal;
        try {
            signal = active.strategy().evaluate(prices);
        } catch (RuntimeException e) {
            log.error("[AUTOMATION] strategy evaluation failed id={} symbol={} error={}",
                    definition.getId(), active.symbol(), e.getClass().getSimpleName());
            return;
        }
        log.debug("[AUTOMATION] evaluated id={} symbol={} signal={} reason={}",
                definition.getId(), active.symbol(), signal.type(), signal.reason());
        if (!signal.isTrigger()) {
            return;
        }

        Instant now = clock.instant();
        log.info("[AUTOMATION] event={} strategy={} symbol={} accountId={} trigger={} at={} reason={}",
                OrderOutcome.STRATEGY_TRIGGERED, definition.getId(), active.symbol(), definition.getAccountId(),
                signal.type(), now, signal.reason());
        remember(definition, active.symbol(), signal.type(), OrderOutcome.STRATEGY_TRIGGERED, null, signal.reason(), now);

        PlaceOrderRequest request = PlaceOrderRequest.builder()
                .accountId(definition.getAccountId())
                .symbol(active.symbol())
                .side(signal.type() == SignalType.BUY ? OrderSide.BUY : OrderSide.SELL)
                .quantity(definition.getQuantity())
                .price(quote.getPrice().setScale(2, RoundingMode.HALF_UP))
                .idempotencyKey(keyFor(definition, active.symbol(), signal.type(), quote, prices.size()))
                .build();
        executor.execute(() -> submit(definition, active.symbol(), signal, request));
    }

    private void submit(StrategyDefinition definition, String symbol, StrategySignal signal, PlaceOrderRequest request) {
        log.info("[AUTOMATION] order submission attempt strategy={} symbol={} accountId={} side={} quantity={} idempotencyKey={}",
                definition.getId(), symbol, definition.getAccountId(), request.getSide(), request.getQuantity(),
                request.getIdempotencyKey());
        TradeApiClient.SubmissionResult result;
        try {
            // One attempt. A failure is recorded and left alone: retrying could turn an unknown outcome into two orders.
            result = tradeApi.submit(request);
        } catch (RuntimeException e) {
            result = TradeApiClient.SubmissionResult.failed(e.getClass().getSimpleName());
        }

        Instant now = clock.instant();
        switch (result.status()) {
            case SUBMITTED -> {
                log.info("[AUTOMATION] event={} strategy={} symbol={} accountId={} trigger={} orderId={} at={}",
                        OrderOutcome.ORDER_SUBMITTED, definition.getId(), symbol, definition.getAccountId(),
                        signal.type(), result.orderId(), now);
                remember(definition, symbol, signal.type(), OrderOutcome.ORDER_SUBMITTED, result.orderId(), result.detail(), now);
            }
            case REJECTED -> {
                log.warn("[AUTOMATION] event={} strategy={} symbol={} accountId={} trigger={} detail={} at={}",
                        OrderOutcome.ORDER_REJECTED, definition.getId(), symbol, definition.getAccountId(),
                        signal.type(), result.detail(), now);
                remember(definition, symbol, signal.type(), OrderOutcome.ORDER_REJECTED, null, result.detail(), now);
            }
            case FAILED -> {
                log.error("[AUTOMATION] event={} strategy={} symbol={} accountId={} trigger={} detail={} at={}",
                        OrderOutcome.ORDER_SUBMISSION_FAILED, definition.getId(), symbol, definition.getAccountId(),
                        signal.type(), result.detail(), now);
                remember(definition, symbol, signal.type(), OrderOutcome.ORDER_SUBMISSION_FAILED, null, result.detail(), now);
            }
        }
    }

    private void remember(StrategyDefinition definition, String symbol, SignalType trigger, OrderOutcome outcome,
                          UUID orderId, String detail, Instant at) {
        recent.addFirst(new AutomationResult(definition.getId(), symbol, definition.getAccountId(), trigger, outcome,
                orderId, detail, at));
        while (recent.size() > RECENT_RESULTS) {
            recent.pollLast();
        }
    }

    /** The same trigger on the same observation always gets the same key, so the platform can never take it twice. */
    private static UUID keyFor(StrategyDefinition definition, String symbol, SignalType side, MarketQuote quote, int observations) {
        String basis = definition.getId() + "|" + symbol + "|" + side + "|"
                + (quote.getQuoteAsOf() != null ? quote.getQuoteAsOf().toString() : "n" + observations);
        return UUID.nameUUIDFromBytes(basis.getBytes(StandardCharsets.UTF_8));
    }
}
