package com.capstone.etp.executor.service;

import com.capstone.etp.executor.domain.ExecutionDecision;
import com.capstone.etp.executor.domain.ExecutionOrder;
import com.capstone.etp.executor.domain.OrderSide;
import com.capstone.etp.executor.domain.OrderStatus;
import com.capstone.etp.executor.domain.Quote;
import com.capstone.etp.executor.domain.RejectionReason;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class LimitOrderFillRuleTest {

    private final LimitOrderFillRule rule = new LimitOrderFillRule();

    @Test
    void fillsBuyAtAskWhenLimitAtOrAboveAsk() {
        ExecutionOrder order = order(OrderSide.BUY, "100.00");
        Quote quote = quote("99.995", "100.004");

        ExecutionDecision decision = rule.decide(order, quote);

        assertThat(decision.getStatus()).isEqualTo(OrderStatus.FILLED);
        assertThat(decision.getExecutionPrice()).isEqualByComparingTo("100.00");
    }

    @Test
    void fillsSellAtBidWhenLimitAtOrBelowBid() {
        ExecutionOrder order = order(OrderSide.SELL, "99.90");
        Quote quote = quote("100.00", "100.10");

        ExecutionDecision decision = rule.decide(order, quote);

        assertThat(decision.getStatus()).isEqualTo(OrderStatus.FILLED);
        assertThat(decision.getExecutionPrice()).isEqualByComparingTo("100.00");
    }

    @Test
    void rejectsOrderOutsideMarketableRange() {
        ExecutionOrder order = order(OrderSide.BUY, "99.00");
        Quote quote = quote("98.90", "100.00");

        ExecutionDecision decision = rule.decide(order, quote);

        assertThat(decision.getStatus()).isEqualTo(OrderStatus.REJECTED);
        assertThat(decision.getRejectionReason()).isEqualTo(RejectionReason.LIMIT_NOT_MARKETABLE);
    }

    private ExecutionOrder order(OrderSide side, String limitPrice) {
        return ExecutionOrder.builder()
                .id(UUID.randomUUID())
                .accountId(1L)
                .instrumentId(10L)
                .symbol("AAPL")
                .side(side)
                .quantity(10)
                .limitPrice(new BigDecimal(limitPrice))
                .status(OrderStatus.NEW)
                .build();
    }

    private Quote quote(String bid, String ask) {
        return Quote.builder()
                .symbol("AAPL")
                .bid(new BigDecimal(bid))
                .ask(new BigDecimal(ask))
                .last(new BigDecimal("99.50"))
                .build();
    }
}
