package com.capstone.etp.entity;

import com.capstone.etp.entity.exception.AccountNotActiveException;
import com.capstone.etp.entity.exception.AccountNotFoundException;
import com.capstone.etp.entity.exception.DomainException;
import com.capstone.etp.entity.exception.DuplicateOrderException;
import com.capstone.etp.entity.exception.InstrumentNotFoundException;
import com.capstone.etp.entity.exception.InsufficientFundsException;
import com.capstone.etp.entity.exception.InsufficientHoldingsException;
import com.capstone.etp.entity.exception.OrderValidationException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Covers business rules 1 to 8, each firing and each not firing, plus the
 * evaluation order itself. Plain objects only: no repository, no database,
 * provable in milliseconds.
 */
class OrderLogicTest {

    private final OrderValidator validator = new OrderValidator();

    private Account activeAccount(BigDecimal balance) {
        return new Account(1L, "ACC-REF-1", "Ada Lovelace", "USD",
                AccountStatus.ACTIVE, balance, 0L);
    }

    private Instrument tradableInstrument() {
        return new Instrument("FX:AAPL", "Apple Inc.", "EQUITY", "USD");
    }

    private PlaceOrderRequest buyRequest(long quantity, BigDecimal price) {
        return new PlaceOrderRequest(1L, "FX:AAPL", OrderSide.BUY, quantity, price, "IDEMPOTENCY-KEY-01");
    }

    private PlaceOrderRequest sellRequest(long quantity, BigDecimal price) {
        return new PlaceOrderRequest(1L, "FX:AAPL", OrderSide.SELL, quantity, price, "IDEMPOTENCY-KEY-01");
    }

    // Rule 1: the account must exist
    @Test
    void rule1FiresWhenAccountMissing() {
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertThrows(AccountNotFoundException.class,
                () -> validator.validate(request, null, tradableInstrument(), null, false));
    }

    @Test
    void rule1DoesNotFireWhenAccountExists() {
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        Account account = activeAccount(new BigDecimal("1000.00"));
        assertDoesNotThrow(() -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    // Rule 2: the account must be ACTIVE
    @Test
    void rule2FiresWhenAccountSuspended() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        account.suspend();
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertThrows(AccountNotActiveException.class,
                () -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    @Test
    void rule2DoesNotFireWhenAccountActive() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertDoesNotThrow(() -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    // Rule 3: the instrument must exist and be tradable
    @Test
    void rule3FiresWhenInstrumentMissing() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertThrows(InstrumentNotFoundException.class,
                () -> validator.validate(request, account, null, null, false));
    }

    @Test
    void rule3FiresWhenInstrumentDelisted() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        Instrument instrument = tradableInstrument();
        instrument.delist();
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertThrows(InstrumentNotFoundException.class,
                () -> validator.validate(request, account, instrument, null, false));
    }

    @Test
    void rule3DoesNotFireWhenInstrumentTradable() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertDoesNotThrow(() -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    // Rule 4: quantity must be greater than zero
    @Test
    void rule4FiresWhenQuantityIsZero() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(0, new BigDecimal("10.00"));
        assertThrows(OrderValidationException.class,
                () -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    @Test
    void rule4DoesNotFireWhenQuantityPositive() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(1, new BigDecimal("10.00"));
        assertDoesNotThrow(() -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    // Rule 5: price must be greater than zero
    @Test
    void rule5FiresWhenPriceIsZero() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(10, BigDecimal.ZERO);
        assertThrows(OrderValidationException.class,
                () -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    @Test
    void rule5DoesNotFireWhenPricePositive() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("0.01"));
        assertDoesNotThrow(() -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    // Rule 6: on a BUY, the cash balance must cover quantity * price
    @Test
    void rule6FiresWhenBuyExceedsBalance() {
        Account account = activeAccount(new BigDecimal("50.00"));
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00")); // costs 100.00
        assertThrows(InsufficientFundsException.class,
                () -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    @Test
    void rule6DoesNotFireWhenBalanceCoversBuy() {
        Account account = activeAccount(new BigDecimal("100.00"));
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00")); // costs 100.00
        assertDoesNotThrow(() -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    // Rule 7: on a SELL, the held quantity must cover the order quantity
    @Test
    void rule7FiresWhenSellExceedsHolding() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        Position position = new Position(1L, "FX:AAPL");
        position.applyBuy(5, new BigDecimal("10.00"));
        PlaceOrderRequest request = sellRequest(10, new BigDecimal("10.00"));
        assertThrows(InsufficientHoldingsException.class,
                () -> validator.validate(request, account, tradableInstrument(), position, false));
    }

    @Test
    void rule7DoesNotFireWhenHoldingCoversSell() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        Position position = new Position(1L, "FX:AAPL");
        position.applyBuy(10, new BigDecimal("10.00"));
        PlaceOrderRequest request = sellRequest(10, new BigDecimal("10.00"));
        assertDoesNotThrow(() -> validator.validate(request, account, tradableInstrument(), position, false));
    }

    // Rule 8: the idempotency key must not already have been used
    @Test
    void rule8FiresWhenIdempotencyKeyReused() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertThrows(DuplicateOrderException.class,
                () -> validator.validate(request, account, tradableInstrument(), null, true));
    }

    @Test
    void rule8DoesNotFireWhenIdempotencyKeyIsNew() {
        Account account = activeAccount(new BigDecimal("1000.00"));
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertDoesNotThrow(() -> validator.validate(request, account, tradableInstrument(), null, false));
    }

    // Evaluation order: the first failure wins, tested independently of the eight rules
    @Test
    void evaluationOrderPicksAccountStatusOverInsufficientFunds() {
        // suspended AND no cash: rule 2 must win, not rule 6
        Account account = activeAccount(new BigDecimal("0.00"));
        account.suspend();
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        DomainException ex = assertThrows(AccountNotActiveException.class,
                () -> validator.validate(request, account, tradableInstrument(), null, false));
        assertEquals("ACC-403", ex.getCode());
    }

    @Test
    void evaluationOrderPicksAccountExistenceOverInstrumentExistence() {
        // missing account AND missing instrument: rule 1 must win
        PlaceOrderRequest request = buyRequest(10, new BigDecimal("10.00"));
        assertThrows(AccountNotFoundException.class,
                () -> validator.validate(request, null, null, null, false));
    }
}
