package com.capstone.etp.automation;

import com.capstone.etp.dto.MarketQuote;
import com.capstone.etp.dto.PlaceOrderRequest;
import com.capstone.etp.security.JwtClaims;
import com.capstone.etp.security.JwtVerifier;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Switching on and off while it runs, the platform kill switch, and the token automation signs for itself. */
class AutomationReloadTest {

    private static final Instant T0 = Instant.parse("2026-10-07T10:00:00Z");
    private static final String SECRET = "test-secret-key-with-at-least-sixty-four-bytes-for-hs512-validation-12345";

    private final TradeApiClient tradeApi = mock(TradeApiClient.class);
    private final AutomationMapper store = mock(AutomationMapper.class);
    private final AutomationProperties properties = new AutomationProperties();
    private int tick;

    private static StrategyDefinition strategy() {
        StrategyDefinition definition = new StrategyDefinition();
        definition.setId("5");
        definition.setType(StrategyType.MA_CROSSOVER);
        definition.setAccountId(7L);
        definition.setSymbol("AAPL");
        definition.setQuantity(10);
        definition.setShortPeriod(2);
        definition.setLongPeriod(4);
        definition.setEnabled(true);
        return definition;
    }

    private AutomationService build() {
        when(tradeApi.submit(any())).thenReturn(TradeApiClient.SubmissionResult.submitted(UUID.randomUUID(), "NEW"));
        return new AutomationService(properties, store, tradeApi, Runnable::run, Clock.fixed(T0, ZoneOffset.UTC));
    }

    private void feed(AutomationService service, double... prices) {
        for (double price : prices) {
            service.onQuote(MarketQuote.builder().symbol("AAPL").price(BigDecimal.valueOf(price)).quoteAsOf(T0.plusSeconds(++tick)).build());
        }
    }

    @Test
    void aStrategySwitchedOnWhileRunningStartsTradingAndOneSwitchedOffStops() {
        when(store.findEnabled()).thenReturn(List.of());
        AutomationService service = build();
        feed(service, 10, 10, 10, 10, 12);
        verify(tradeApi, never()).submit(any());

        when(store.findEnabled()).thenReturn(List.of(strategy()));
        service.reload();
        feed(service, 12, 12, 12, 12, 14, 14, 14);
        verify(tradeApi, times(1)).submit(any());

        when(store.findEnabled()).thenReturn(List.of());
        service.reload();
        feed(service, 14, 14, 14, 14, 20);
        verify(tradeApi, times(1)).submit(any());
    }

    @Test
    void reportsHowManyPricesAreCollectedAgainstHowManyAreNeeded() {
        when(store.findEnabled()).thenReturn(List.of(strategy()));
        AutomationService service = build();

        feed(service, 10, 10, 10);

        assertEquals(new AutomationService.Progress(3, 5), service.progressOf("5").orElseThrow());
        assertTrue(service.progressOf("999").isEmpty());
    }

    @Test
    void thePlatformKillSwitchStopsEverythingEvenForSwitchedOnStrategies() {
        when(store.findEnabled()).thenReturn(List.of(strategy()));
        properties.setEnabled(false);
        AutomationService service = build();

        feed(service, 10, 10, 10, 10, 12);

        verify(tradeApi, never()).submit(any());
    }

    @Test
    void anUnreadableStoreKeepsTheStrategiesAlreadyRunning() {
        when(store.findEnabled()).thenReturn(List.of(strategy()));
        AutomationService service = build();
        when(store.findEnabled()).thenThrow(new IllegalStateException("db down"));

        service.reload();
        feed(service, 10, 10, 10, 10, 12);

        verify(tradeApi, times(1)).submit(any());
    }

    @Test
    void theTokenAutomationSignsIsAShortLivedCustomerTokenForOneAccountAndTheTradeApiAcceptsIt() {
        AutomationTokenIssuer issuer = new AutomationTokenIssuer(SECRET, "auth-service", Clock.systemUTC());

        JwtClaims claims = new JwtVerifier(SECRET, "HS256", "auth-service").verify(issuer.tokenFor(7L));

        assertEquals(List.of(7L), claims.accountIds());
        assertEquals(List.of("CUSTOMER"), claims.roles());
    }

    @Test
    void anExpiredAutomationTokenIsRefused() {
        AutomationTokenIssuer issuer = new AutomationTokenIssuer(SECRET, "auth-service",
                Clock.fixed(Instant.now().minusSeconds(3600), ZoneOffset.UTC));

        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class,
                () -> new JwtVerifier(SECRET, "HS256", "auth-service").verify(issuer.tokenFor(7L)));
    }

    @Test
    void itPostsTheOrderWithATokenForTheOrdersOwnAccount() {
        // The wiring between the issuer and the client: the client asks for the order's account.
        TokenSource tokens = mock(TokenSource.class);
        when(tokens.tokenFor(7L)).thenReturn("t7");
        PlaceOrderRequest request = PlaceOrderRequest.builder().accountId(7L).build();

        assertEquals("t7", tokens.tokenFor(request.getAccountId()));
    }
}
