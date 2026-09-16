package com.capstone.etp.executor.rule;

import com.capstone.etp.executor.entity.Order;
import com.capstone.etp.executor.enums.OrderSide;
import com.capstone.etp.executor.kafka.models.QuotePayload;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Pure fill rule — no database access, no network calls.
 *
 * <h3>Side and price semantics</h3>
 * <ul>
 *   <li>A BUY fills when {@code limitPrice >= ask}.  Execution price = ask.</li>
 *   <li>A SELL fills when {@code limitPrice <= bid}.  Execution price = bid.</li>
 *   <li>{@code price} (last trade) is never used for settlement.</li>
 * </ul>
 *
 * <h3>Rounding</h3>
 * Fauxnance quotes carry more than two decimal places. Both sides of the
 * comparison use the same 2-dp rounded value so an order can never fill at a
 * price that failed its own check. Rounding mode is HALF_UP, matching the
 * column type {@code NUMERIC(10,2)}.
 *
 * <h3>Partial fills</h3>
 * Out of scope: the order status enumeration has no working state between NEW
 * and a terminal status. An unmarketable order is rejected, not rested.
 */
public final class FillRule {

    private FillRule() {
        // utility class
    }

    public static FillDecision apply(Order order, QuotePayload quote) {
        if (order.getSide() == OrderSide.BUY) {
            BigDecimal ask = quote.getAsk().setScale(2, RoundingMode.HALF_UP);
            if (order.getLimitPrice().compareTo(ask) >= 0) {
                return FillDecision.fill(ask);
            }
            return FillDecision.reject("PRICE_NOT_MET");
        } else {
            // SELL
            BigDecimal bid = quote.getBid().setScale(2, RoundingMode.HALF_UP);
            if (order.getLimitPrice().compareTo(bid) <= 0) {
                return FillDecision.fill(bid);
            }
            return FillDecision.reject("PRICE_NOT_MET");
        }
    }
}

