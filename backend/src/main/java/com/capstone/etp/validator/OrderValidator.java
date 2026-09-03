package com.capstone.etp.validator;

import com.capstone.etp.entity.*;
import com.capstone.etp.enums.OrderSide;
import com.capstone.etp.exception.*;

import java.math.BigDecimal;

public class OrderValidator {

    public void validate(Order order) {

        checkAccountExists(order);

        checkAccountActive(order);

        checkInstrument(order);

        checkQuantity(order);

        checkPrice(order);

        if (order.getSide() == OrderSide.BUY) {

            checkFunds(order);
        }

        if (order.getSide() == OrderSide.SELL) {

            checkHoldings(order);
        }

        checkIdempotencyKey(order);
    }

    // Rule 1
    private void checkAccountExists(Order order) {

        if (order.getAccount() == null) {

            throw new AccountNotFoundException(null);
        }
    }

    // Rule 2
    private void checkAccountActive(Order order) {

        Account account = order.getAccount();

        if (!account.isActive()) {

            throw new AccountNotActiveException(
                    account.getId(),
                    account.getStatus().name());
        }
    }

    // Rule 3
    private void checkInstrument(Order order) {

        Instrument instrument = order.getInstrument();

        if (instrument == null) {

            throw new InstrumentNotFoundException(
                    null,
                    InstrumentNotFoundException.Reason.UNKNOWN_SYMBOL);
        }

        if (!instrument.isTradable()) {

            throw new InstrumentNotFoundException(
                    instrument.getSymbol(),
                    InstrumentNotFoundException.Reason.NOT_TRADABLE);
        }
    }

    // Rule 4
    private void checkQuantity(Order order) {

        if (order.getQuantity() <= 0) {

            throw new InvalidOrderValueException(
                    "Invalid quantity");
        }
    }

    // Rule 5
    private void checkPrice(Order order) {

        if (order.getLimitPrice() == null ||
                order.getLimitPrice()
                        .compareTo(BigDecimal.ZERO) <= 0) {

            throw new InvalidOrderValueException(
                    "Invalid price");
        }
    }

    // Rule 6
    private void checkFunds(Order order) {

        BigDecimal requiredAmount = order.getLimitPrice()
                .multiply(
                        BigDecimal.valueOf(
                                order.getQuantity()));

        Account account = order.getAccount();

        if (!account.canAfford(requiredAmount)) {

            throw new InsufficientFundsException(
                    account.getId(),
                    requiredAmount,
                    account.getCashBalance());
        }
    }

    // Rule 7
    private void checkHoldings(Order order) {

        Account account = order.getAccount();

        if (account.getPortfolio() == null ||
                account.getPortfolio().getHoldings() == null) {

            throw new InsufficientHoldingsException(
                    account.getId(),
                    order.getInstrument().getSymbol(),
                    (long) order.getQuantity(),
                    0L);
        }

        PortfolioHolding holding = account.getPortfolio()
                .getHoldings()
                .stream()
                .filter(h -> h.getInstrument()
                        .equals(order.getInstrument()))
                .findFirst()
                .orElse(null);

        int heldQuantity = holding == null
                ? 0
                : holding.getQuantity();

        if (heldQuantity < order.getQuantity()) {

            throw new InsufficientHoldingsException(
                    account.getId(),
                    order.getInstrument().getSymbol(),
                    (long) order.getQuantity(),
                    (long) heldQuantity);
        }
    }

    // Rule 8

    // Rule 8
    private void checkIdempotencyKey(Order order) {

        if (order.getAccount().getOrders() == null) {

            return;
        }

        boolean duplicate = order.getAccount()
                .getOrders()
                .stream()
                .anyMatch(existing ->

                order.getIdempotencyKey()
                        .equals(
                                existing.getIdempotencyKey())

                );

        if (duplicate) {

            throw new DuplicateOrderException(
                    order.getIdempotencyKey());
        }

    }

}