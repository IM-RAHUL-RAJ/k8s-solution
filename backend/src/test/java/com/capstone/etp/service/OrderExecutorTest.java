package com.capstone.etp.service;

import com.capstone.etp.entity.*;
import com.capstone.etp.enums.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;

class OrderExecutorTest {

        @Test
        void buyCreatesExecutedTransaction() {

                Account account = Account.builder()
                                .id(1L)
                                .cashBalance(new BigDecimal("10000"))
                                .build();

                Portfolio portfolio = Portfolio.builder()
                                .id(1L)
                                .account(account)
                                .holdings(new ArrayList<>())
                                .build();

                account.setPortfolio(portfolio);

                Instrument instrument = Instrument.builder()
                                .id(1L)
                                .symbol("AAPL")
                                .name("Apple Inc.")
                                .tradable(true)
                                .build();

                PortfolioHolding holding = PortfolioHolding.builder()
                                .id(1L)
                                .portfolio(portfolio)
                                .instrument(instrument)
                                .quantity(10)
                                .avgPrice(new BigDecimal("80"))
                                .build();

                portfolio.getHoldings()
                                .add(holding);

                Order order = Order.builder()
                                .account(account)
                                .instrument(instrument)
                                .side(OrderSide.BUY)
                                .quantity(5)
                                .limitPrice(new BigDecimal("100"))
                                .build();

                OrderExecution executor = new OrderExecution();

                Transaction transaction = executor.execute(order);

                assertEquals(
                                TransactionStatus.EXECUTED,
                                transaction.getStatus());

                assertEquals(
                                OrderStatus.FILLED,
                                order.getStatus());

                assertEquals(
                                new BigDecimal("9500"),
                                account.getCashBalance());

                assertEquals(
                                15,
                                holding.getQuantity());

                assertEquals(
                                new BigDecimal("86.67"),
                                holding.getAvgPrice());
        }

        @Test
        void sellCreatesExecutedTransaction() {

                Account account = Account.builder()
                                .id(1L)
                                .cashBalance(new BigDecimal("10000"))
                                .build();

                Portfolio portfolio = Portfolio.builder()
                                .id(1L)
                                .account(account)
                                .holdings(new ArrayList<>())
                                .build();

                account.setPortfolio(portfolio);

                Instrument instrument = Instrument.builder()
                                .id(1L)
                                .symbol("AAPL")
                                .name("Apple Inc.")
                                .tradable(true)
                                .build();

                PortfolioHolding holding = PortfolioHolding.builder()
                                .id(1L)
                                .portfolio(portfolio)
                                .instrument(instrument)
                                .quantity(10)
                                .avgPrice(new BigDecimal("100"))
                                .build();

                portfolio.getHoldings()
                                .add(holding);

                Order order = Order.builder()
                                .account(account)
                                .instrument(instrument)
                                .side(OrderSide.SELL)
                                .quantity(5)
                                .limitPrice(new BigDecimal("100"))
                                .build();

                OrderExecution executor = new OrderExecution();

                Transaction transaction = executor.execute(order);

                assertEquals(
                                TransactionStatus.EXECUTED,
                                transaction.getStatus());

                assertEquals(
                                OrderStatus.FILLED,
                                order.getStatus());

                assertEquals(
                                new BigDecimal("10500"),
                                account.getCashBalance());

                assertEquals(
                                5,
                                holding.getQuantity());
        }

        @Test
        void failedExecutionCreatesFailedTransaction() {

                Account account = Account.builder()
                                .id(1L)
                                .cashBalance(new BigDecimal("10000"))
                                .build();

                /*
                 * No portfolio / holding is attached.
                 * Executor will fail while trying to update position.
                 * It should convert this into a failed execution.
                 */

                Instrument instrument = Instrument.builder()
                                .id(1L)
                                .symbol("AAPL")
                                .tradable(true)
                                .build();

                Order order = Order.builder()
                                .account(account)
                                .instrument(instrument)
                                .side(OrderSide.BUY)
                                .quantity(5)
                                .limitPrice(new BigDecimal("100"))
                                .build();

                OrderExecution executor = new OrderExecution();

                Transaction transaction = executor.execute(order);

                assertEquals(
                                TransactionStatus.FAILED,
                                transaction.getStatus());

                assertEquals(
                                OrderStatus.REJECTED,
                                order.getStatus());
        }

}