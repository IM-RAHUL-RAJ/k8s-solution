package com.capstone.etp.validator;

import com.capstone.etp.entity.Account;
import com.capstone.etp.entity.Instrument;
import com.capstone.etp.entity.Order;
import com.capstone.etp.enums.AccountStatus;
import com.capstone.etp.enums.AccountType;
import com.capstone.etp.enums.AssetClass;
import com.capstone.etp.enums.OrderSide;
import com.capstone.etp.exception.CurrencyMismatchException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OrderValidatorTest {

    private final OrderValidator orderValidator = new OrderValidator();


    @Test
    void validate_throwsCurrencyMismatch_whenAccountTypeAndAssetClassDiffer() {

        Order order = baseOrder(new BigDecimal("150.00"));

        Account account =
                baseAccount(
                        AccountType.US_EQUITY,
                        "USD",
                        "10000.00"
                );

        Instrument instrument =
                baseInstrument(
                        "RELIANCE.NS",
                        AssetClass.INDIAN_EQUITY,
                        "INR"
                );


        CurrencyMismatchException exception =
                assertThrows(
                        CurrencyMismatchException.class,
                        () -> orderValidator.validate(
                                order,
                                account,
                                instrument,
                                null,
                                Collections.emptyList()
                        )
                );


        assertEquals(
                "CUR-422",
                exception.getCatalogueCode()
        );
    }


    @Test
    void validate_acceptsForex_whenAccountCurrencyMatchesQuoteCurrency() {

        Order order =
                baseOrder(
                        new BigDecimal("1.20")
                );


        Account account =
                baseAccount(
                        AccountType.FOREX,
                        "USD",
                        "10000.00"
                );


        Instrument instrument =
                baseInstrument(
                        "FX:INRUSD",
                        AssetClass.FX,
                        "USD"
                );


        orderValidator.validate(
                order,
                account,
                instrument,
                null,
                Collections.emptyList()
        );


        // FX:INRUSD means 1 INR = X USD.
        // Validator only checks currency compatibility.
        // It does not convert price anymore.
        assertEquals(
                new BigDecimal("1.20"),
                order.getLimitPrice()
        );
    }


    @Test
    void validate_throwsCurrencyMismatch_whenForexAccountCurrencyDoesNotMatchQuoteCurrency() {

        Order order =
                baseOrder(
                        new BigDecimal("100.00")
                );


        Account account =
                baseAccount(
                        AccountType.FOREX,
                        "EUR",
                        "10000.00"
                );


        Instrument instrument =
                baseInstrument(
                        "FX:INRUSD",
                        AssetClass.FX,
                        "USD"
                );


        CurrencyMismatchException exception =
                assertThrows(
                        CurrencyMismatchException.class,
                        () -> orderValidator.validate(
                                order,
                                account,
                                instrument,
                                null,
                                Collections.emptyList()
                        )
                );


        assertEquals(
                "CUR-422",
                exception.getCatalogueCode()
        );
    }


    @Test
    void validate_keepsNonForexLimitPriceUnchanged() {

        Order order =
                baseOrder(
                        new BigDecimal("250.50")
                );


        Account account =
                baseAccount(
                        AccountType.US_EQUITY,
                        "USD",
                        "10000.00"
                );


        Instrument instrument =
                baseInstrument(
                        "AAPL",
                        AssetClass.US_EQUITY,
                        "USD"
                );


        orderValidator.validate(
                order,
                account,
                instrument,
                null,
                Collections.emptyList()
        );


        assertEquals(
                new BigDecimal("250.50"),
                order.getLimitPrice()
        );
    }


    private Order baseOrder(BigDecimal price) {

        return Order.builder()
                .id(UUID.randomUUID())
                .accountId(1L)
                .instrumentId(1L)
                .idempotencyKey(UUID.randomUUID())
                .side(OrderSide.BUY)
                .quantity(1)
                .limitPrice(price)
                .build();
    }


    private Account baseAccount(
            AccountType type,
            String currency,
            String balance) {

        return Account.builder()
                .id(1L)
                .accountType(type)
                .currency(currency)
                .cashBalance(new BigDecimal(balance))
                .status(AccountStatus.ACTIVE)
                .build();
    }


    private Instrument baseInstrument(
            String symbol,
            AssetClass assetClass,
            String currency) {

        return Instrument.builder()
                .id(1L)
                .symbol(symbol)
                .assetClass(assetClass)
                .currency(currency)
                .tradable(true)
                .build();
    }
}