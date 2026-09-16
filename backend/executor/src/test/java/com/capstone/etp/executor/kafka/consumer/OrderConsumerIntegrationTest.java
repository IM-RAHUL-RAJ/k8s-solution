package com.capstone.etp.executor.kafka.consumer;

import com.capstone.etp.executor.entity.Account;
import com.capstone.etp.executor.entity.Instrument;
import com.capstone.etp.executor.entity.Order;
import com.capstone.etp.executor.enums.AccountStatus;
import com.capstone.etp.executor.enums.OrderSide;
import com.capstone.etp.executor.enums.OrderStatus;
import com.capstone.etp.executor.exception.PriceUnavailableException;
import com.capstone.etp.executor.client.FauxnanceClient;
import com.capstone.etp.executor.kafka.models.KafkaMessageEnvelope;
import com.capstone.etp.executor.kafka.models.OrderPlacedPayload;
import com.capstone.etp.executor.kafka.models.QuotePayload;
import com.capstone.etp.executor.mapper.ExecutorOrderMapper;
import com.capstone.etp.executor.service.ExecutionService;
import com.capstone.etp.executor.service.SettlementService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderConsumerIntegrationTest {

    @Mock
    private ExecutorOrderMapper mapper;

    @Mock
    private FauxnanceClient fauxnanceClient;

    @Mock
    private KafkaTemplate<String, String> kafkaTemplate;

    @Mock
    private Acknowledgment acknowledgment;

    private ObjectMapper objectMapper;
    private SettlementService settlementService;
    private ExecutionService executionService;
    private TradeEventPublisher tradeEventPublisher;
    private DeadLetterPublisher deadLetterPublisher;
    private OrderConsumer orderConsumer;

    private static final UUID ORDER_ID = UUID.randomUUID();
    private static final Long ACCOUNT_ID = 100L;
    private static final Long INSTR_ID = 10L;
    private static final String SYMBOL = "AAPL";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        settlementService = new SettlementService(mapper);
        executionService = new ExecutionService(mapper, fauxnanceClient, settlementService);
        setField(executionService, "maxLockAttempts", 3);

        tradeEventPublisher = new TradeEventPublisher(kafkaTemplate, objectMapper);
        setField(tradeEventPublisher, "tradeEventsTopic", "trade-events");

        deadLetterPublisher = new DeadLetterPublisher(kafkaTemplate);

        orderConsumer = new OrderConsumer(executionService, tradeEventPublisher, deadLetterPublisher, objectMapper);
    }

    @Test
    void testEndToEnd_OrderFilled_PublishesTradeEventAndAcks() {
        // Setup order
        Order order = Order.builder()
                .id(ORDER_ID)
                .accountId(ACCOUNT_ID)
                .instrumentId(INSTR_ID)
                .side(OrderSide.BUY)
                .quantity(10)
                .limitPrice(new BigDecimal("150.00"))
                .status(OrderStatus.NEW)
                .build();
        when(mapper.findOrderById(ORDER_ID)).thenReturn(order);

        Instrument instrument = Instrument.builder().id(INSTR_ID).symbol(SYMBOL).tradable(true).build();
        when(mapper.findInstrumentById(INSTR_ID)).thenReturn(instrument);

        QuotePayload quote = new QuotePayload();
        quote.setSymbol(SYMBOL);
        quote.setAsk(new BigDecimal("148.50"));
        quote.setBid(new BigDecimal("148.20"));
        when(fauxnanceClient.getQuote(SYMBOL)).thenReturn(quote);

        Account account = Account.builder()
                .id(ACCOUNT_ID)
                .cashBalance(new BigDecimal("2000.00"))
                .status(AccountStatus.ACTIVE)
                .version(1L)
                .build();
        when(mapper.findAccountById(ACCOUNT_ID)).thenReturn(account);
        when(mapper.settleOrderStatus(eq(ORDER_ID), eq(OrderStatus.FILLED), any())).thenReturn(1);
        when(mapper.findHolding(ACCOUNT_ID, INSTR_ID)).thenReturn(null);
        when(mapper.findPortfolioIdByAccountId(ACCOUNT_ID)).thenReturn(50L);
        when(mapper.updateAccountCashAndVersion(eq(ACCOUNT_ID), any(), eq(1L))).thenReturn(1);

        // Prepare message record
        OrderPlacedPayload payload = new OrderPlacedPayload(ORDER_ID, ACCOUNT_ID, SYMBOL, "BUY", 10, new BigDecimal("150.00"), UUID.randomUUID().toString(), Instant.now());
        KafkaMessageEnvelope<OrderPlacedPayload> envelope = new KafkaMessageEnvelope<>(UUID.randomUUID(), "ORDER_PLACED", Instant.now(), "trade-api", 1, payload);

        String json;
        try {
            json = objectMapper.writeValueAsString(envelope);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        ConsumerRecord<String, String> record = new ConsumerRecord<>("orders", 0, 1L, ACCOUNT_ID.toString(), json);

        // Execute consumer
        orderConsumer.consume(record, acknowledgment);

        // Verify DB updates
        verify(mapper).settleOrderStatus(eq(ORDER_ID), eq(OrderStatus.FILLED), any());
        verify(mapper).updateAccountCashAndVersion(eq(ACCOUNT_ID), eq(new BigDecimal("515.00")), eq(1L)); // 2000 - (148.50 * 10)
        verify(mapper).upsertHolding(eq(50L), eq(INSTR_ID), eq(10), eq(new BigDecimal("148.50")));

        // Verify trade-event published
        ArgumentCaptor<String> eventCaptor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq("trade-events"), eq(ACCOUNT_ID.toString()), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).contains("ORDER_FILLED");
        assertThat(eventCaptor.getValue()).contains("148.50");

        // Verify offset acknowledged
        verify(acknowledgment).acknowledge();
    }

    @Test
    void testEndToEnd_OrderRejected_PriceNotMet_PublishesRejectEventAndAcks() {
        Order order = Order.builder()
                .id(ORDER_ID)
                .accountId(ACCOUNT_ID)
                .instrumentId(INSTR_ID)
                .side(OrderSide.BUY)
                .quantity(10)
                .limitPrice(new BigDecimal("140.00")) // lower than ask
                .status(OrderStatus.NEW)
                .build();
        when(mapper.findOrderById(ORDER_ID)).thenReturn(order);

        Instrument instrument = Instrument.builder().id(INSTR_ID).symbol(SYMBOL).tradable(true).build();
        when(mapper.findInstrumentById(INSTR_ID)).thenReturn(instrument);

        QuotePayload quote = new QuotePayload();
        quote.setSymbol(SYMBOL);
        quote.setAsk(new BigDecimal("148.50"));
        quote.setBid(new BigDecimal("148.20"));
        when(fauxnanceClient.getQuote(SYMBOL)).thenReturn(quote);

        Account account = Account.builder().id(ACCOUNT_ID).cashBalance(new BigDecimal("2000.00")).status(AccountStatus.ACTIVE).version(1L).build();
        when(mapper.findAccountById(ACCOUNT_ID)).thenReturn(account);
        when(mapper.settleOrderStatus(eq(ORDER_ID), eq(OrderStatus.REJECTED), any())).thenReturn(1);

        OrderPlacedPayload payload = new OrderPlacedPayload(ORDER_ID, ACCOUNT_ID, SYMBOL, "BUY", 10, new BigDecimal("140.00"), UUID.randomUUID().toString(), Instant.now());
        KafkaMessageEnvelope<OrderPlacedPayload> envelope = new KafkaMessageEnvelope<>(UUID.randomUUID(), "ORDER_PLACED", Instant.now(), "trade-api", 1, payload);

        String json;
        try {
            json = objectMapper.writeValueAsString(envelope);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        ConsumerRecord<String, String> record = new ConsumerRecord<>("orders", 0, 1L, ACCOUNT_ID.toString(), json);

        orderConsumer.consume(record, acknowledgment);

        verify(mapper).settleOrderStatus(eq(ORDER_ID), eq(OrderStatus.REJECTED), any());
        verify(mapper, never()).updateAccountCashAndVersion(any(), any(), any());

        ArgumentCaptor<String> eventCaptor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq("trade-events"), eq(ACCOUNT_ID.toString()), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).contains("ORDER_REJECTED");
        assertThat(eventCaptor.getValue()).contains("PRICE_NOT_MET");

        verify(acknowledgment).acknowledge();
    }

    @Test
    void testEndToEnd_PriceUnavailable_PublishesRejectEventAndAcks() {
        Order order = Order.builder()
                .id(ORDER_ID)
                .accountId(ACCOUNT_ID)
                .instrumentId(INSTR_ID)
                .side(OrderSide.BUY)
                .quantity(10)
                .limitPrice(new BigDecimal("150.00"))
                .status(OrderStatus.NEW)
                .build();
        when(mapper.findOrderById(ORDER_ID)).thenReturn(order);

        Instrument instrument = Instrument.builder().id(INSTR_ID).symbol(SYMBOL).tradable(true).build();
        when(mapper.findInstrumentById(INSTR_ID)).thenReturn(instrument);

        when(fauxnanceClient.getQuote(SYMBOL)).thenThrow(new PriceUnavailableException("Fauxnance service unavailable"));

        Account account = Account.builder().id(ACCOUNT_ID).cashBalance(new BigDecimal("2000.00")).status(AccountStatus.ACTIVE).version(1L).build();
        when(mapper.findAccountById(ACCOUNT_ID)).thenReturn(account);
        when(mapper.settleOrderStatus(eq(ORDER_ID), eq(OrderStatus.REJECTED), any())).thenReturn(1);

        OrderPlacedPayload payload = new OrderPlacedPayload(ORDER_ID, ACCOUNT_ID, SYMBOL, "BUY", 10, new BigDecimal("150.00"), UUID.randomUUID().toString(), Instant.now());
        KafkaMessageEnvelope<OrderPlacedPayload> envelope = new KafkaMessageEnvelope<>(UUID.randomUUID(), "ORDER_PLACED", Instant.now(), "trade-api", 1, payload);

        String json;
        try {
            json = objectMapper.writeValueAsString(envelope);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        ConsumerRecord<String, String> record = new ConsumerRecord<>("orders", 0, 1L, ACCOUNT_ID.toString(), json);

        orderConsumer.consume(record, acknowledgment);

        verify(mapper).settleOrderStatus(eq(ORDER_ID), eq(OrderStatus.REJECTED), any());
        ArgumentCaptor<String> eventCaptor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq("trade-events"), eq(ACCOUNT_ID.toString()), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).contains("ORDER_REJECTED");
        assertThat(eventCaptor.getValue()).contains("PRICE_UNAVAILABLE");

        verify(acknowledgment).acknowledge();
    }

    @Test
    void testEndToEnd_MalformedJson_DeadLettersAndAcks() {
        ConsumerRecord<String, String> record = new ConsumerRecord<>("orders", 0, 1L, "key", "not-a-valid-json");

        orderConsumer.consume(record, acknowledgment);

        verify(kafkaTemplate).send(any(org.apache.kafka.clients.producer.ProducerRecord.class));
        verify(acknowledgment).acknowledge();
        verify(mapper, never()).findOrderById(any());
    }

    private static void setField(Object target, String name, Object value) {
        try {
            var field = target.getClass().getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }
}
