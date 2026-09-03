package com.capstone.etp.service;

import com.capstone.etp.entity.Account;
import com.capstone.etp.entity.Instrument;
import com.capstone.etp.entity.Order;
import com.capstone.etp.entity.Portfolio;
import com.capstone.etp.enums.*;
import com.capstone.etp.exception.*;
import com.capstone.etp.validator.OrderValidator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;

class OrderValidatorTest {

        private final OrderValidator validator = new OrderValidator();

        private Order createValidBuyOrder() {

                Account account = Account.builder()
                                .id(1L)
                                .status(AccountStatus.ACTIVE)
                                .cashBalance(new BigDecimal("10000"))
                                .orders(new ArrayList<>())
                                .build();

                Instrument instrument = Instrument.builder()
                                .id(1L)
                                .symbol("AAPL")
                                .tradable(true)
                                .build();

                return Order.builder()
                                .account(account)
                                .instrument(instrument)
                                .side(OrderSide.BUY)
                                .quantity(10)
                                .limitPrice(new BigDecimal("100"))
                                .idempotencyKey("ORDER123")
                                .build();
        }

        @Test
        void validBuyOrderPassesValidation() {

                Order order = createValidBuyOrder();

                assertDoesNotThrow(
                                () -> validator.validate(order));
        }

        @Test
        void accountNotFoundRejected() {

                Order order = createValidBuyOrder();

                order.setAccount(null);

                AccountNotFoundException ex = assertThrows(
                                AccountNotFoundException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "ACC-404",
                                ex.getCatalogueCode());
        }

        @Test
        void inactiveAccountRejected() {

                Order order = createValidBuyOrder();

                order.getAccount()
                                .setStatus(AccountStatus.SUSPENDED);

                AccountNotActiveException ex = assertThrows(
                                AccountNotActiveException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "ACC-403",
                                ex.getCatalogueCode());
        }

        @Test
        void unknownInstrumentRejected() {

                Order order = createValidBuyOrder();

                order.setInstrument(null);

                InstrumentNotFoundException ex = assertThrows(
                                InstrumentNotFoundException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "INS-404",
                                ex.getCatalogueCode());
        }

        @Test
        void nonTradableInstrumentRejected() {

                Order order = createValidBuyOrder();

                order.getInstrument()
                                .setTradable(false);

                InstrumentNotFoundException ex = assertThrows(
                                InstrumentNotFoundException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "INS-404",
                                ex.getCatalogueCode());
        }

        @Test
        void invalidQuantityRejected() {

                Order order = createValidBuyOrder();

                order.setQuantity(0);

                InvalidOrderValueException ex = assertThrows(
                                InvalidOrderValueException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "VAL-422",
                                ex.getCatalogueCode());
        }

        @Test
        void invalidPriceRejected() {

                Order order = createValidBuyOrder();

                order.setLimitPrice(
                                BigDecimal.ZERO);

                InvalidOrderValueException ex = assertThrows(
                                InvalidOrderValueException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "VAL-422",
                                ex.getCatalogueCode());
        }

        @Test
        void insufficientFundsRejected() {

                Order order = createValidBuyOrder();

                order.getAccount()
                                .setCashBalance(
                                                new BigDecimal("10"));

                InsufficientFundsException ex = assertThrows(
                                InsufficientFundsException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "ORD-400",
                                ex.getCatalogueCode());
        }

        @Test
        void insufficientHoldingsRejected() {

                Order order = createValidBuyOrder();

                order.setSide(
                                OrderSide.SELL);

                Portfolio portfolio = Portfolio.builder()
                                .holdings(new ArrayList<>())
                                .build();

                order.getAccount()
                                .setPortfolio(portfolio);

                InsufficientHoldingsException ex = assertThrows(
                                InsufficientHoldingsException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "ORD-409",
                                ex.getCatalogueCode());
        }

        @Test
        void duplicateIdempotencyKeyRejected() {

                Order order = createValidBuyOrder();

                Order previousOrder = Order.builder()
                                .idempotencyKey("ORDER123")
                                .build();

                order.getAccount()
                                .getOrders()
                                .add(previousOrder);

                DuplicateOrderException ex = assertThrows(
                                DuplicateOrderException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "ORD-409",
                                ex.getCatalogueCode());
        }

        @Test
        void firstRuleWinsWhenMultipleRulesFail() {

                Order order = createValidBuyOrder();

                // Rule 2 failure
                order.getAccount()
                                .setStatus(
                                                AccountStatus.SUSPENDED);

                // Rule 6 failure also
                order.getAccount()
                                .setCashBalance(
                                                BigDecimal.ZERO);

                ETPException ex = assertThrows(
                                ETPException.class,
                                () -> validator.validate(order));

                assertEquals(
                                "ACC-403",
                                ex.getCatalogueCode());
        }

}