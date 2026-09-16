package com.capstone.etp.executor.service;

import com.capstone.etp.executor.domain.AccountSnapshot;
import com.capstone.etp.executor.domain.AccountStatus;
import com.capstone.etp.executor.domain.ExecutionOrder;
import com.capstone.etp.executor.domain.InstrumentSnapshot;
import com.capstone.etp.executor.domain.OrderSide;
import com.capstone.etp.executor.domain.OrderStatus;
import com.capstone.etp.executor.domain.Quote;
import com.capstone.etp.executor.pricing.PricingUnavailableException;
import com.capstone.etp.executor.pricing.QuoteClient;
import com.capstone.etp.executor.repository.ExecutionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderExecutionServiceTest {

    @Mock
    private ExecutionMapper mapper;
    @Mock
    private QuoteClient quoteClient;

    private OrderExecutionService service;
    private UUID orderId;

    @BeforeEach
    void setUp() {
        service = new OrderExecutionService(mapper, quoteClient, new LimitOrderFillRule());
        orderId = UUID.randomUUID();
    }

    @Test
    void buyLimitAtOrAboveQuoteFillsAtAsk() {
        stubOrder(OrderSide.BUY, "101.00", 10);
        stubActiveAccount("2000.00");
        stubTradableInstrument();
        when(quoteClient.fetchQuote("AAPL")).thenReturn(quote("100.00", "100.50"));
        when(mapper.updateOrderStatusIfCurrentStatusMatches(eq(orderId), eq(OrderStatus.NEW), eq(OrderStatus.FILLED), any(Instant.class)))
                .thenReturn(1);

        service.handleOrderPlaced(orderId);

        verifyFinalStatus(OrderStatus.FILLED);
    }

    @Test
    void sellLimitAtOrBelowQuoteFillsAtBid() {
        stubOrder(OrderSide.SELL, "99.00", 5);
        stubActiveAccount("100.00");
        stubTradableInstrument();
        when(mapper.findHoldingQuantity(1L, 10L)).thenReturn(10);
        when(quoteClient.fetchQuote("AAPL")).thenReturn(quote("100.00", "100.50"));
        when(mapper.updateOrderStatusIfCurrentStatusMatches(eq(orderId), eq(OrderStatus.NEW), eq(OrderStatus.FILLED), any(Instant.class)))
                .thenReturn(1);

        service.handleOrderPlaced(orderId);

        verifyFinalStatus(OrderStatus.FILLED);
    }

    @Test
    void executionTimeRecheckRejectsWhenAccountCannotAfford() {
        stubOrder(OrderSide.BUY, "101.00", 10);
        stubActiveAccount("500.00");
        stubTradableInstrument();
        when(quoteClient.fetchQuote("AAPL")).thenReturn(quote("100.00", "100.50"));
        when(mapper.updateOrderStatusIfCurrentStatusMatches(eq(orderId), eq(OrderStatus.NEW), eq(OrderStatus.REJECTED), any(Instant.class)))
                .thenReturn(1);

        service.handleOrderPlaced(orderId);

        verifyFinalStatus(OrderStatus.REJECTED);
    }

    @Test
    void suspendedAccountDoesNotTrade() {
        stubOrder(OrderSide.BUY, "101.00", 10);
        when(mapper.findAccountById(1L)).thenReturn(AccountSnapshot.builder()
                .id(1L)
                .status(AccountStatus.SUSPENDED)
                .cashBalance(new BigDecimal("2000.00"))
                .build());
        when(mapper.updateOrderStatusIfCurrentStatusMatches(eq(orderId), eq(OrderStatus.NEW), eq(OrderStatus.REJECTED), any(Instant.class)))
                .thenReturn(1);

        service.handleOrderPlaced(orderId);

        verify(quoteClient, never()).fetchQuote(any());
        verifyFinalStatus(OrderStatus.REJECTED);
    }

    @Test
    void noPriceAvailableIsResolvedByRejectingOrder() {
        stubOrder(OrderSide.BUY, "101.00", 10);
        stubActiveAccount("2000.00");
        stubTradableInstrument();
        when(quoteClient.fetchQuote("AAPL")).thenThrow(new PricingUnavailableException("downstream unavailable"));
        when(mapper.updateOrderStatusIfCurrentStatusMatches(eq(orderId), eq(OrderStatus.NEW), eq(OrderStatus.REJECTED), any(Instant.class)))
                .thenReturn(1);

        service.handleOrderPlaced(orderId);

        verifyFinalStatus(OrderStatus.REJECTED);
    }

    @Test
    void outsideMarketableRangeRejectsOrder() {
        stubOrder(OrderSide.BUY, "99.00", 10);
        stubActiveAccount("2000.00");
        stubTradableInstrument();
        when(quoteClient.fetchQuote("AAPL")).thenReturn(quote("98.00", "100.50"));
        when(mapper.updateOrderStatusIfCurrentStatusMatches(eq(orderId), eq(OrderStatus.NEW), eq(OrderStatus.REJECTED), any(Instant.class)))
                .thenReturn(1);

        service.handleOrderPlaced(orderId);

        verifyFinalStatus(OrderStatus.REJECTED);
    }

    private void verifyFinalStatus(OrderStatus status) {
        ArgumentCaptor<OrderStatus> statusCaptor = ArgumentCaptor.forClass(OrderStatus.class);
        verify(mapper).updateOrderStatusIfCurrentStatusMatches(eq(orderId), eq(OrderStatus.NEW), statusCaptor.capture(), any(Instant.class));
        assertThat(statusCaptor.getValue()).isEqualTo(status);
    }

    private void stubOrder(OrderSide side, String limitPrice, int quantity) {
        when(mapper.findOrderById(orderId)).thenReturn(ExecutionOrder.builder()
                .id(orderId)
                .accountId(1L)
                .instrumentId(10L)
                .symbol("AAPL")
                .side(side)
                .quantity(quantity)
                .limitPrice(new BigDecimal(limitPrice))
                .status(OrderStatus.NEW)
                .build());
    }

    private void stubActiveAccount(String cash) {
        when(mapper.findAccountById(1L)).thenReturn(AccountSnapshot.builder()
                .id(1L)
                .status(AccountStatus.ACTIVE)
                .cashBalance(new BigDecimal(cash))
                .build());
    }

    private void stubTradableInstrument() {
        when(mapper.findInstrumentById(10L)).thenReturn(InstrumentSnapshot.builder()
                .id(10L)
                .symbol("AAPL")
                .tradable(true)
                .build());
    }

    private Quote quote(String bid, String ask) {
        return Quote.builder()
                .symbol("AAPL")
                .bid(new BigDecimal(bid))
                .ask(new BigDecimal(ask))
                .last(new BigDecimal("100.20"))
                .build();
    }
}
