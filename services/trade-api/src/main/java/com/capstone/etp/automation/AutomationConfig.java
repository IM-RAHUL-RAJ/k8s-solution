package com.capstone.etp.automation;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Wires automation, only when app.automation.enabled=true. Orders are submitted on one dedicated thread so a slow
 * Trade API cannot hold up the market-data consumer; one thread also keeps the submissions in the order they triggered.
 */
@Configuration
@EnableConfigurationProperties(AutomationProperties.class)
@ConditionalOnProperty(name = "app.automation.enabled", havingValue = "true")
class AutomationConfig {

    @Bean
    TradeApiClient automationTradeApiClient(AutomationProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(properties.getConnectTimeoutMs()));
        factory.setReadTimeout(Duration.ofMillis(properties.getReadTimeoutMs()));
        RestClient restClient = RestClient.builder()
                .baseUrl(properties.getTradeApiBaseUrl())
                .requestFactory(factory)
                .build();
        return new RestTradeApiClient(restClient, properties.getServiceToken());
    }

    @Bean(destroyMethod = "shutdown")
    java.util.concurrent.ExecutorService automationOrderExecutor() {
        return Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "automation-orders");
            thread.setDaemon(true);
            return thread;
        });
    }

    @Bean
    AutomationService automationService(AutomationProperties properties, TradeApiClient tradeApi,
                                        java.util.concurrent.ExecutorService automationOrderExecutor, Clock clock) {
        Executor executor = automationOrderExecutor;
        return new AutomationService(properties, tradeApi, executor, clock);
    }
}
