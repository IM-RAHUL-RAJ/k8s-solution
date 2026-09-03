package com.capstone.etp.entity;

import com.capstone.etp.enums.AssetClass;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class InstrumentTest {

        @Test
        void instrumentIsTradableWhenApiMarksItTradable() {

                Instrument instrument = Instrument.builder()
                                .id(1L)
                                .symbol("AAPL")
                                .exchange("NASDAQ")
                                .name("Apple Inc.")
                                .currency("USD")
                                .assetClass(AssetClass.US_EQUITY)
                                .tradable(true)
                                .build();

                assertTrue(instrument.isTradable());

                assertEquals(
                                "AAPL",
                                instrument.getSymbol());

                assertEquals(
                                "USD",
                                instrument.getCurrency());

                assertEquals(
                                AssetClass.US_EQUITY,
                                instrument.getAssetClass());
        }

        @Test
        void instrumentIsNotTradableWhenApiMarksItStopped() {

                Instrument instrument = Instrument.builder()
                                .id(1L)
                                .symbol("AAPL")
                                .exchange("NASDAQ")
                                .name("Apple Inc.")
                                .currency("USD")
                                .assetClass(AssetClass.US_EQUITY)
                                .tradable(false)
                                .stoppedAt(LocalDateTime.now())
                                .build();

                assertFalse(
                                instrument.isTradable());

                assertNotNull(
                                instrument.getStoppedAt());
        }

        @Test
        void cryptoInstrumentHasCorrectAssetClassAndCurrency() {

                Instrument instrument = Instrument.builder()
                                .id(2L)
                                .symbol("BTC-USD")
                                .exchange("COINBASE")
                                .name("Bitcoin")
                                .currency("USD")
                                .assetClass(AssetClass.CRYPTO)
                                .tradable(true)
                                .build();

                assertTrue(
                                instrument.isTradable());

                assertEquals(
                                AssetClass.CRYPTO,
                                instrument.getAssetClass());

                assertEquals(
                                "USD",
                                instrument.getCurrency());
        }

        @Test
        void forexInstrumentHasCorrectAssetClassAndCurrency() {

                Instrument instrument = Instrument.builder()
                                .id(3L)
                                .symbol("EUR/USD")
                                .exchange("FX")
                                .name("Euro / US Dollar")
                                .currency("USD")
                                .assetClass(AssetClass.FX)
                                .tradable(true)
                                .build();

                assertTrue(
                                instrument.isTradable());

                assertEquals(
                                AssetClass.FX,
                                instrument.getAssetClass());

                assertEquals(
                                "USD",
                                instrument.getCurrency());
        }
}