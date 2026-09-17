package com.capstone.etp.executor.service;

import com.capstone.etp.executor.entity.Account;
import com.capstone.etp.executor.entity.Instrument;
import com.capstone.etp.executor.entity.Order;
import com.capstone.etp.executor.entity.PortfolioHolding;
import com.capstone.etp.executor.enums.OrderSide;
import com.capstone.etp.executor.enums.OrderStatus;
import com.capstone.etp.executor.exception.OptimisticLockRetryException;
import com.capstone.etp.executor.mapper.ExecutorOrderMapper;
import com.capstone.etp.executor.rule.FillDecision;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Locale;

/**
 * Encapsulates the single atomic settlement transaction described in the spec:
 *
 * <ol>
 *   <li>Guarded state transition on {@code orders} (WHERE status = 'NEW')</li>
 *   <li>Fresh account read and runtime re-checks (account state, currency, funds/holdings)</li>
 *   <li>Cash debit/credit with optimistic lock</li>
 *   <li>Holdings upsert or decrease</li>
 *   <li>Transaction record insert</li>
 * </ol>
 *
 * <p>Steps 1–5 share one Postgres transaction.  Publishing to Kafka and
 * acknowledging the Kafka offset happen AFTER this method returns (i.e., after
 * the commit), in the caller ({@link com.capstone.etp.executor.kafka.consumer.OrderConsumer}).
 *
 * <p><strong>Optimistic lock retry:</strong> if step 3 finds that the account
 * version has changed concurrently, it throws {@link OptimisticLockRetryException}
 * (unchecked), which causes Spring to roll back the whole transaction — including
 * the order status update in step 1.  The outer retry loop in
 * {@link ExecutionService} then re-invokes this method.
 *
 * <p><strong>Duplicate delivery:</strong> if the guarded UPDATE in step 1
 * returns 0 rows the order is already settled; this method returns
 * {@link SettlementResult#alreadyHandled(java.util.UUID)} immediately.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettlementService {

    private final ExecutorOrderMapper mapper;

    @Transactional
    public SettlementResult settle(Order order, FillDecision initialDecision, Instrument instrument) {
        Instant now = Instant.now();

        // --- Re-checks inside the transaction with fresh account state --------

        Account account = mapper.findAccountById(order.getAccountId());

        FillDecision finalDecision = initialDecision;

        if (initialDecision.isFill()) {
            if (!account.isActive()) {
                // Account was suspended or closed after the order was accepted.
                finalDecision = FillDecision.reject("ACCOUNT_NOT_ACTIVE");
            } else if (!currencyMatches(account.getCurrency(), instrument.getCurrency())) {
                log.info("Order {} rejected due to currency mismatch: accountCurrency={} instrumentCurrency={}",
                        order.getId(), account.getCurrency(), instrument.getCurrency());
                finalDecision = FillDecision.reject("CURRENCY_MISMATCH");
            } else if (order.getSide() == OrderSide.BUY) {
                // Rule 6 re-check: funds at limit price (not executed price).
                BigDecimal required = order.getLimitPrice()
                        .multiply(BigDecimal.valueOf(order.getQuantity()));
                if (!account.canAfford(required)) {
                    finalDecision = FillDecision.reject("INSUFFICIENT_FUNDS");
                }
            } else {
                // Rule 7 re-check: held quantity at execution time.
                PortfolioHolding holding = mapper.findHolding(order.getAccountId(), order.getInstrumentId());
                int heldQty = holding != null ? holding.getQuantity() : 0;
                if (heldQty < order.getQuantity()) {
                    finalDecision = FillDecision.reject("INSUFFICIENT_HOLDINGS");
                }
            }
        }

        OrderStatus finalStatus = finalDecision.isFill() ? OrderStatus.FILLED : OrderStatus.REJECTED;

        // --- Guarded state transition -----------------------------------------
        // Returns 0 when a prior delivery already settled this order.
        int updated = mapper.settleOrderStatus(order.getId(), finalStatus, now);
        if (updated == 0) {
            log.info("Order {} already settled by a prior delivery — skipping duplicate (accountId={})",
                    order.getId(), order.getAccountId());
            return SettlementResult.alreadyHandled(order.getId());
        }

        // --- Apply writes based on final decision -----------------------------

        if (finalDecision.isFill()) {
            return applyFill(order, account, instrument, finalDecision.getExecutedPrice(), now);
        } else {
            return applyReject(order, account, instrument.getSymbol(), finalDecision.getReason(), now);
        }
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private SettlementResult applyFill(Order order, Account account,
                                       Instrument instrument, BigDecimal executedPrice,
                                       Instant now) {
        // Load current holding before writes so we can compute positionQuantityAfter
        PortfolioHolding currentHolding = mapper.findHolding(order.getAccountId(), order.getInstrumentId());
        int existingQty      = currentHolding != null ? currentHolding.getQuantity() : 0;
        BigDecimal existingAvg = currentHolding != null ? currentHolding.getAvgPrice() : BigDecimal.ZERO;

        // Cash delta
        BigDecimal tradeValue = executedPrice.multiply(BigDecimal.valueOf(order.getQuantity()));
        BigDecimal cashDelta  = order.getSide() == OrderSide.BUY ? tradeValue.negate() : tradeValue;
        BigDecimal newBalance = account.getCashBalance().add(cashDelta);

        // Log balance pre-change to make replay demos and audits straightforward
        log.info("Account {} balance before {} — applying cash delta {} => proposed balance {}",
                account.getId(), account.getCashBalance(), cashDelta, newBalance);

        // Optimistic-locked cash update
        int rows = mapper.updateAccountCashAndVersion(account.getId(), newBalance, account.getVersion());
        if (rows == 0) {
            // Another write bumped the version; roll back everything and retry.
            throw new OptimisticLockRetryException(
                    "Account " + account.getId() + " version conflict — will retry");
        }

        // Log successful cash update (still inside the DB transaction)
        log.info("Account {} cash updated to {} (applied by order {})",
                account.getId(), newBalance, order.getId());

        // Holdings
        Long portfolioId = mapper.findPortfolioIdByAccountId(account.getId());

        int posQtyAfter;
        BigDecimal avgCostAfter;

        if (order.getSide() == OrderSide.BUY) {
            posQtyAfter = existingQty + order.getQuantity();
            avgCostAfter = existingQty == 0
                    ? executedPrice
                    : existingAvg.multiply(BigDecimal.valueOf(existingQty))
                                 .add(executedPrice.multiply(BigDecimal.valueOf(order.getQuantity())))
                                 .divide(BigDecimal.valueOf(posQtyAfter), 2, RoundingMode.HALF_UP);
            mapper.upsertHolding(portfolioId, order.getInstrumentId(),
                    order.getQuantity(), executedPrice);
        } else {
            posQtyAfter  = existingQty - order.getQuantity();
            avgCostAfter = existingAvg; // SELL does not change average cost
            mapper.decreaseHolding(account.getId(), order.getInstrumentId(), order.getQuantity());
        }

        // Transaction record
        mapper.insertTransaction(order.getId(), order.getQuantity(),
                executedPrice, "EXECUTED", null, now);

        log.info("Order {} FILLED at {} — cash delta {}, position after {}",
                order.getId(), executedPrice, cashDelta, posQtyAfter);

        return new SettlementResult(
                order.getId(), order.getAccountId(), instrument.getSymbol(),
                order.getSide().name(), order.getQuantity(), order.getLimitPrice(),
                executedPrice, OrderStatus.FILLED, null,
                cashDelta, posQtyAfter, avgCostAfter, now, false);
    }

    private SettlementResult applyReject(Order order, Account account,
                                         String symbol, String reason, Instant now) {
        // executed_price is NOT NULL with CHECK > 0; store the limit price as the
        // "attempted" price so the constraint is satisfied.
        mapper.insertTransaction(order.getId(), order.getQuantity(),
                order.getLimitPrice(), "FAILED", reason, now);

        // Current holding for positionQuantityAfter / averageCostAfter in the event
        PortfolioHolding holding = mapper.findHolding(order.getAccountId(), order.getInstrumentId());
        int posQtyAfter    = holding != null ? holding.getQuantity() : 0;
        BigDecimal avgCost = holding != null ? holding.getAvgPrice()  : BigDecimal.ZERO;

        log.info("Order {} REJECTED — reason: {} — account {} balance remains {}",
                order.getId(), reason, account.getId(), account.getCashBalance());

        return new SettlementResult(
                order.getId(), order.getAccountId(), symbol,
                order.getSide().name(), order.getQuantity(), order.getLimitPrice(),
                null, OrderStatus.REJECTED, reason,
                BigDecimal.ZERO, posQtyAfter, avgCost, now, false);
    }

    private boolean currencyMatches(String accountCurrency, String instrumentCurrency) {
        if (accountCurrency == null || instrumentCurrency == null) {
            return false;
        }
        String normalizedAccountCurrency = accountCurrency.trim().toUpperCase(Locale.ROOT);
        String normalizedInstrumentCurrency = instrumentCurrency.trim().toUpperCase(Locale.ROOT);
        return !normalizedAccountCurrency.isEmpty()
                && !normalizedInstrumentCurrency.isEmpty()
                && normalizedAccountCurrency.equals(normalizedInstrumentCurrency);
    }
}
