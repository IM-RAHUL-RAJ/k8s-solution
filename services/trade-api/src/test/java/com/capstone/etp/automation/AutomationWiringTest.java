package com.capstone.etp.automation;

import com.capstone.etp.kafka.consumer.QuoteObserver;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Automation exists only when it is switched on, and then it listens to the price stream like any other observer. */
class AutomationWiringTest {

    @Configuration
    static class Platform {
        @Bean
        Clock clock() {
            return Clock.systemUTC();
        }
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of())
            .withUserConfiguration(Platform.class, AutomationConfig.class);

    @Test
    void isAbsentByDefault() {
        runner.run(context -> assertEquals(0, context.getBeansOfType(AutomationService.class).size()));
    }

    @Test
    void whenEnabledItIsAQuoteObserverWithItsStrategiesLoaded() {
        runner.withPropertyValues(
                        "app.automation.enabled=true",
                        "app.automation.service-token=t",
                        "app.automation.strategies[0].id=aapl-ma",
                        "app.automation.strategies[0].type=MA_CROSSOVER",
                        "app.automation.strategies[0].account-id=1",
                        "app.automation.strategies[0].symbol=AAPL",
                        "app.automation.strategies[0].quantity=100",
                        "app.automation.strategies[0].short-period=20",
                        "app.automation.strategies[0].long-period=50",
                        "app.automation.strategies[0].enabled=true")
                .run(context -> {
                    assertEquals(1, context.getBeansOfType(QuoteObserver.class).size());
                    assertEquals(1, context.getBean(AutomationProperties.class).getStrategies().size());
                });
    }
}
