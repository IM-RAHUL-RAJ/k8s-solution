package com.capstone.etp.automation;

import com.capstone.etp.security.AccountAuthorizer;
import com.capstone.etp.testsupport.TestIdentity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AutomationStatusControllerTest {

    private AutomationProperties properties;
    private ObjectProvider<AutomationService> service;

    @BeforeEach
    void setUp() {
        TestIdentity.customer(1L);
        properties = new AutomationProperties();
        service = mock(ObjectProvider.class);
        when(service.getIfAvailable()).thenReturn(null);
    }

    @AfterEach
    void tearDown() {
        TestIdentity.clear();
    }

    private static StrategyDefinition definition(String id, long account, boolean enabled) {
        StrategyDefinition definition = new StrategyDefinition();
        definition.setId(id);
        definition.setType(StrategyType.MA_CROSSOVER);
        definition.setAccountId(account);
        definition.setSymbol("aapl");
        definition.setQuantity(10);
        definition.setShortPeriod(2);
        definition.setLongPeriod(4);
        definition.setEnabled(enabled);
        return definition;
    }

    @Test
    void showsOnlyTheCallersOwnStrategiesAndSaysAutomationIsNotRunningWhenItIsOff() {
        properties.setStrategies(List.of(definition("mine", 1, true), definition("theirs", 2, true)));

        var body = new AutomationStatusController(properties, service, new AccountAuthorizer()).status().getBody();

        assertFalse(body.running());
        assertEquals(List.of("mine"), body.strategies().stream().map(AutomationStatusController.StrategyView::id).toList());
        assertEquals("AAPL", body.strategies().get(0).symbol());
        assertEquals("short 2, long 4", body.strategies().get(0).parameters());
        assertTrue(body.results().isEmpty());
    }

    @Test
    void reportsWhatIsWrongWithAnInvalidStrategy() {
        StrategyDefinition bad = definition("bad", 1, true);
        bad.setQuantity(0);
        properties.setStrategies(List.of(bad));

        var body = new AutomationStatusController(properties, service, new AccountAuthorizer()).status().getBody();

        assertFalse(body.strategies().get(0).problems().isEmpty());
    }
}
