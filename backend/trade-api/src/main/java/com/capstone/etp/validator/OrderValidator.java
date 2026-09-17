package com.capstone.etp.validator;

import com.capstone.etp.entity.Account;
import com.capstone.etp.entity.Instrument;
import com.capstone.etp.entity.Order;
import com.capstone.etp.entity.PortfolioHolding;
import com.capstone.etp.enums.AccountType;
import com.capstone.etp.enums.AssetClass;
import com.capstone.etp.enums.OrderSide;
import com.capstone.etp.exception.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;

@Service 
public class OrderValidator {

    private static final Map<String, BigDecimal> FX_CONVERSION_RATES = buildFxConversionRates();

    public void validate(
            Order order,
            Account account,
            Instrument instrument,
            PortfolioHolding holding,
            List<Order> existingOrders) {

        checkAccountExists(order, account);

        checkAccountActive(account);

        checkInstrument(instrument);

        checkAccountTypeAndAssetClassCompatibility(account, instrument);

        checkQuantity(order);

        checkPrice(order);

        if (order.getSide() == OrderSide.BUY) {
            checkFunds(order, account);
        }

        if (order.getSide() == OrderSide.SELL) {
            checkHoldings(order, account, instrument, holding);
        }

        normalizeForexLimitPrice(order, account, instrument);

        checkIdempotencyKey(order, existingOrders);
    }


    // Rule 1
    private void checkAccountExists(
            Order order,
            Account account) {

        if (account == null) {
            throw new AccountNotFoundException(
                    order.getAccountId());
        }
    }


    // Rule 2
    private void checkAccountActive(Account account) {

        if (!account.isActive()) {

            throw new AccountNotActiveException(
                    account.getId(),
                    account.getStatus().name());
        }
    }


    // Rule 3
    private void checkInstrument(Instrument instrument) {

        if (instrument == null) {

            throw new InstrumentNotFoundException(
                    instrument.getSymbol(),
                    InstrumentNotFoundException.Reason.UNKNOWN_SYMBOL);
        }

        if (!instrument.isTradable()) {

            throw new InstrumentNotFoundException(
                    instrument.getSymbol(),
                    InstrumentNotFoundException.Reason.NOT_TRADABLE);
        }
    }


    // Rule 4
    private void checkAccountTypeAndAssetClassCompatibility(Account account, Instrument instrument) {
        AccountType accountType = account.getAccountType();
        AssetClass assetClass = instrument.getAssetClass();

        if (accountType == null || assetClass == null) {
            throw new CurrencyMismatchException("Account type or instrument asset class is missing");
        }

        boolean matches;
        if (accountType == AccountType.FOREX) {
            matches = assetClass == AssetClass.FX;
        } else {
            matches = accountType.name().equals(assetClass.name());
        }

        if (!matches) {
            throw new CurrencyMismatchException(
                    "accountType=" + accountType + " is incompatible with assetClass=" + assetClass);
        }
    }

    // Rule 5
    private void checkQuantity(Order order) {

        if (order.getQuantity() <= 0) {

            throw new InvalidOrderValueException(
                    "Invalid quantity");
        }
    }


    // Rule 6
    private void checkPrice(Order order) {

        if (order.getLimitPrice() == null ||
                order.getLimitPrice()
                        .compareTo(BigDecimal.ZERO) <= 0) {

            throw new InvalidOrderValueException(
                    "Invalid price");
        }
    }


    // Rule 7
    private void checkFunds(
            Order order,
            Account account) {

        BigDecimal requiredAmount =
                order.getLimitPrice()
                        .multiply(
                                BigDecimal.valueOf(
                                        order.getQuantity()));

        if (!account.canAfford(requiredAmount)) {

            throw new InsufficientFundsException(
                    account.getId(),
                    requiredAmount,
                    account.getCashBalance());
        }
    }


    // Rule 8
    private void checkHoldings(
            Order order,
            Account account,
            Instrument instrument,
            PortfolioHolding holding) {

        int heldQuantity = holding == null
                ? 0
                : holding.getQuantity();

        if (heldQuantity < order.getQuantity()) {

            throw new InsufficientHoldingsException(
                    account.getId(),
                    instrument.getSymbol(),
                    (long) order.getQuantity(),
                    (long) heldQuantity);
        }
    }


    // Rule 9
    private void normalizeForexLimitPrice(Order order, Account account, Instrument instrument) {
        if (instrument.getAssetClass() != AssetClass.FX) {
            return;
        }

        String symbol = instrument.getSymbol();
        String[] pair = parseFxPair(symbol);
        String baseCurrency = pair[0];
        String quoteCurrency = pair[1];

        String accountCurrency = normalizeCurrency(account.getCurrency());
        if (!baseCurrency.equals(accountCurrency)) {
            throw new CurrencyMismatchException(
                    "FOREX order requires account currency " + baseCurrency
                            + " for symbol " + symbol + " but account currency is " + accountCurrency);
        }

        BigDecimal rate = lookupConversionRate(baseCurrency, quoteCurrency, symbol);
        BigDecimal convertedPrice = order.getLimitPrice()
                .multiply(rate)
                .setScale(2, RoundingMode.HALF_UP);
        order.setLimitPrice(convertedPrice);
    }

    // Rule 10
    private void checkIdempotencyKey(
            Order order,
            List<Order> existingOrders) {

        if (existingOrders == null) {
            return;
        }

        boolean duplicate = existingOrders
                .stream()
                .anyMatch(existing ->
                        order.getIdempotencyKey() != null &&
                                order.getIdempotencyKey()
                                        .equals(existing.getIdempotencyKey())
                );

        if (duplicate) {

            throw new DuplicateOrderException(order.getIdempotencyKey());
        }
    }

    private static Map<String, BigDecimal> buildFxConversionRates() {
        Map<String, BigDecimal> rates = new HashMap<>();
        rates.put("USD->INR", new BigDecimal("83.00"));
        rates.put("USD->JPY", new BigDecimal("146.00"));
        rates.put("USD->EUR", new BigDecimal("0.92"));
        rates.put("USD->GBP", new BigDecimal("0.78"));
        rates.put("USD->CHF", new BigDecimal("0.88"));
        rates.put("USD->CAD", new BigDecimal("1.35"));
        rates.put("USD->AUD", new BigDecimal("1.50"));
        rates.put("USD->SGD", new BigDecimal("1.34"));

        addInverse(rates, "USD", "INR");
        addInverse(rates, "USD", "JPY");
        addInverse(rates, "USD", "EUR");
        addInverse(rates, "USD", "GBP");
        addInverse(rates, "USD", "CHF");
        addInverse(rates, "USD", "CAD");
        addInverse(rates, "USD", "AUD");
        addInverse(rates, "USD", "SGD");

        return Collections.unmodifiableMap(rates);
    }

    private static void addInverse(Map<String, BigDecimal> rates, String from, String to) {
        BigDecimal direct = rates.get(from + "->" + to);
        rates.put(to + "->" + from, BigDecimal.ONE.divide(direct, 10, RoundingMode.HALF_UP));
    }

    private BigDecimal lookupConversionRate(String fromCurrency, String toCurrency, String symbol) {
        String rateKey = fromCurrency + "->" + toCurrency;
        BigDecimal rate = FX_CONVERSION_RATES.get(rateKey);
        if (rate == null) {
            throw new CurrencyMismatchException(
                    "No configured FX conversion rate for " + rateKey + " required by symbol " + symbol);
        }
        return rate;
    }

    private String[] parseFxPair(String symbol) {
        if (symbol == null || !symbol.startsWith("FX:") || symbol.length() != 9) {
            throw new CurrencyMismatchException("Invalid FOREX instrument symbol format: " + symbol);
        }
        String pair = symbol.substring(3).toUpperCase(Locale.ROOT);
        String base = pair.substring(0, 3);
        String quote = pair.substring(3, 6);
        return new String[]{base, quote};
    }

    private String normalizeCurrency(String currency) {
        if (currency == null) {
            return "";
        }
        return currency.trim().toUpperCase(Locale.ROOT);
    }
}