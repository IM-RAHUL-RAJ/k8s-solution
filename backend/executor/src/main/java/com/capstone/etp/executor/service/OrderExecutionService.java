package com.capstone.etp.executor.service;

import com.capstone.etp.executor.domain.AccountSnapshot;
import com.capstone.etp.executor.domain.AccountStatus;
import com.capstone.etp.executor.domain.ExecutionDecision;
import com.capstone.etp.executor.domain.ExecutionOrder;
import com.capstone.etp.executor.domain.InstrumentSnapshot;
import com.capstone.etp.executor.domain.OrderSide;
import com.capstone.etp.executor.domain.OrderStatus;
import com.capstone.etp.executor.domain.Quote;
import com.capstone.etp.executor.domain.RejectionReason;
import com.capstone.etp.executor.pricing.PricingUnavailableException;
import com.capstone.etp.executor.pricing.QuoteClient;
import com.capstone.etp.executor.repository.ExecutionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderExecutionService {

    private final ExecutionMapper executionMapper;
    private final QuoteClient quoteClient;
    private final LimitOrderFillRule fillRule;

    @Transactional
    public void handleOrderPlaced(UUID orderId) {
        ExecutionOrder order = executionMapper.findOrderById(orderId);
        if (order == null) {
            log.warn("Dropping event for unknown orderId={}", orderId);
            return;
        }
        if (!order.isNew()) {
            log.info("Duplicate delivery ignored for orderId={} status={}", orderId, order.getStatus());
            return;
        }

        AccountSnapshot account = executionMapper.findAccountById(order.getAccountId());
        if (account == null || account.getStatus() != AccountStatus.ACTIVE) {
            reject(orderId, RejectionReason.ACCOUNT_NOT_ACTIVE);
            return;
        }

        InstrumentSnapshot instrument = executionMapper.findInstrumentById(order.getInstrumentId());
        if (instrument == null || !instrument.isTradable()) {
            reject(orderId, RejectionReason.INSTRUMENT_NOT_TRADABLE);
            return;
        }

        Quote quote;
        try {
            quote = quoteClient.fetchQuote(order.getSymbol());
        } catch (PricingUnavailableException ex) {
            log.warn("Quote unavailable for orderId={} symbol={}: {}", orderId, order.getSymbol(), ex.getMessage());
            reject(orderId, RejectionReason.PRICING_UNAVAILABLE);
            return;
        }

        ExecutionDecision decision = fillRule.decide(order, quote);
        if (decision.isFilled() && order.getSide() == OrderSide.BUY && cannotAfford(order, account, decision)) {
            reject(orderId, RejectionReason.INSUFFICIENT_FUNDS_AT_EXECUTION);
            return;
        }
        if (decision.isFilled() && order.getSide() == OrderSide.SELL && insufficientHoldings(order)) {
            reject(orderId, RejectionReason.INSUFFICIENT_HOLDINGS_AT_EXECUTION);
            return;
        }

        updateTerminalStatus(orderId, decision.getStatus());
    }

    private boolean cannotAfford(ExecutionOrder order, AccountSnapshot account, ExecutionDecision decision) {
        BigDecimal required = decision.getExecutionPrice().multiply(BigDecimal.valueOf(order.getQuantity()));
        return account.getCashBalance().compareTo(required) < 0;
    }

    private boolean insufficientHoldings(ExecutionOrder order) {
        Integer holdingQty = executionMapper.findHoldingQuantity(order.getAccountId(), order.getInstrumentId());
        int available = holdingQty == null ? 0 : holdingQty;
        return available < order.getQuantity();
    }

    private void reject(UUID orderId, RejectionReason reason) {
        log.info("Rejecting orderId={} reason={}", orderId, reason);
        updateTerminalStatus(orderId, OrderStatus.REJECTED);
    }

    private void updateTerminalStatus(UUID orderId, OrderStatus newStatus) {
        int updatedRows = executionMapper.updateOrderStatusIfCurrentStatusMatches(
                orderId,
                OrderStatus.NEW,
                newStatus,
                Instant.now());
        if (updatedRows == 0) {
            log.info("Order status was already changed by another delivery orderId={}", orderId);
        }
    }
}
