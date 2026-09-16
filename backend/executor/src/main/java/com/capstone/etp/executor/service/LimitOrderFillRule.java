package com.capstone.etp.executor.service;

import com.capstone.etp.executor.domain.ExecutionDecision;
import com.capstone.etp.executor.domain.ExecutionOrder;
import com.capstone.etp.executor.domain.OrderSide;
import com.capstone.etp.executor.domain.Quote;
import com.capstone.etp.executor.domain.RejectionReason;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class LimitOrderFillRule {

    private static final int MONEY_SCALE = 2;

    public ExecutionDecision decide(ExecutionOrder order, Quote quote) {
        if (quote == null || quote.getAsk() == null || quote.getBid() == null) {
            return ExecutionDecision.rejected(RejectionReason.PRICING_UNAVAILABLE);
        }

        if (order.getSide() == OrderSide.BUY) {
            BigDecimal ask = roundMoney(quote.getAsk());
            BigDecimal limit = roundMoney(order.getLimitPrice());
            if (limit.compareTo(ask) >= 0) {
                return ExecutionDecision.filled(ask);
            }
            return ExecutionDecision.rejected(RejectionReason.LIMIT_NOT_MARKETABLE);
        }

        BigDecimal bid = roundMoney(quote.getBid());
        BigDecimal limit = roundMoney(order.getLimitPrice());
        if (limit.compareTo(bid) <= 0) {
            return ExecutionDecision.filled(bid);
        }
        return ExecutionDecision.rejected(RejectionReason.LIMIT_NOT_MARKETABLE);
    }

    private BigDecimal roundMoney(BigDecimal value) {
        return value.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }
}
