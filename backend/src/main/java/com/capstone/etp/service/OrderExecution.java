package com.capstone.etp.service;

import com.capstone.etp.entity.*;
import com.capstone.etp.enums.OrderSide;
import com.capstone.etp.enums.TransactionStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class OrderExecution {

        public Transaction execute(Order order) {

                try {

                        if (order.getSide() == OrderSide.BUY) {

                                executeBuy(order);

                        }

                        if (order.getSide() == OrderSide.SELL) {

                                executeSell(order);

                        }

                        order.fill();

                        return Transaction.builder()
                                        .order(order)
                                        .quantity(order.getQuantity())
                                        .executedPrice(order.getLimitPrice())
                                        .status(TransactionStatus.EXECUTED)
                                        .executedAt(LocalDateTime.now())
                                        .build();

                } catch (Exception e) {

                        order.reject();

                        return Transaction.builder()
                                        .order(order)
                                        .quantity(order.getQuantity())
                                        .executedPrice(order.getLimitPrice())
                                        .status(TransactionStatus.FAILED)
                                        .executedAt(LocalDateTime.now())
                                        .build();

                }

        }

        private void executeBuy(Order order) {

                BigDecimal amount = order.getLimitPrice()
                                .multiply(
                                                BigDecimal.valueOf(
                                                                order.getQuantity()));

                order.getAccount()
                                .withdraw(amount);

                Portfolio portfolio = order.getAccount()
                                .getPortfolio();

                PortfolioHolding holding = portfolio.getHoldings()
                                .stream()
                                .filter(
                                                h -> h.getInstrument()
                                                                .equals(order.getInstrument()))
                                .findFirst()
                                .orElseThrow();

                holding.updateAveragePrice(
                                order.getQuantity(),
                                order.getLimitPrice());

        }

        private void executeSell(Order order) {

                PortfolioHolding holding = order.getAccount()
                                .getPortfolio()
                                .getHoldings()
                                .stream()
                                .filter(
                                                h -> h.getInstrument()
                                                                .equals(order.getInstrument()))
                                .findFirst()
                                .orElseThrow();

                holding.setQuantity(
                                holding.getQuantity()
                                                -
                                                order.getQuantity());

                BigDecimal amount = order.getLimitPrice()
                                .multiply(
                                                BigDecimal.valueOf(
                                                                order.getQuantity()));

                order.getAccount()
                                .deposit(amount);

        }

}