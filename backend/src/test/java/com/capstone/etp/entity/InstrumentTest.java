package com.capstone.etp.entity;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers isTradable()/getSymbol() on the abstract Instrument, and
 * getCurrency()/getAssetClass() on each concrete subtype (Equity, Crypto,
 * Forex). isTradable() assumed false once stoppedAt is set (delisting).
 */
class InstrumentTest {

    @Test
    void equityIsTradableByDefault() {
        Equity equity = new Equity(1L, "AAPL", "NASDAQ", "Apple Inc.", "USD");
        assertTrue(equity.isTradable());
        assertEquals("AAPL", equity.getSymbol());
        assertEquals("USD", equity.getCurrency());
        assertEquals(AssetClass.US_EQUITY, equity.getAssetClass());
    }

    @Test
    void equityBecomesNotTradableWhenStopped() {
        Equity equity = new Equity(1L, "AAPL", "NASDAQ", "Apple Inc.", "USD");
        equity.stopTrading();
        assertFalse(equity.isTradable());
    }

    @Test
    void cryptoReportsOwnAssetClassAndCurrency() {
        Crypto crypto = new Crypto(2L, "BTC-USD", "COINBASE", "Bitcoin", "USD");
        assertTrue(crypto.isTradable());
        assertEquals(AssetClass.CRYPTO, crypto.getAssetClass());
        assertEquals("USD", crypto.getCurrency());
    }

    @Test
    void forexReportsOwnAssetClassAndCurrency() {
        Forex forex = new Forex(3L, "EUR/USD", "FX", "Euro / US Dollar", "USD");
        assertTrue(forex.isTradable());
        assertEquals(AssetClass.FX, forex.getAssetClass());
        assertEquals("USD", forex.getCurrency());
    }
}
