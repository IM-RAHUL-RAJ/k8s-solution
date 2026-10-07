package com.capstone.etp.automation;

import com.capstone.etp.security.AccountAuthorizer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Read-only: what automation is configured to do for the signed-in customer's own accounts, and what it has done
 * lately. It changes nothing; strategies are set in configuration (see README).
 */
@RestController
@RequestMapping("/api/v1/automation")
@EnableConfigurationProperties(AutomationProperties.class)
public class AutomationStatusController {

    public record StrategyView(String id, String type, Long accountId, String symbol, Integer quantity,
                               boolean enabled, String parameters, List<String> problems) {
    }

    public record ResultView(String strategyId, String symbol, Long accountId, String trigger, String outcome,
                             UUID orderId, String detail, Instant at) {
    }

    public record StatusResponse(boolean running, List<StrategyView> strategies, List<ResultView> results) {
    }

    private final AutomationProperties properties;
    private final ObjectProvider<AutomationService> service;
    private final AccountAuthorizer authorizer;

    AutomationStatusController(AutomationProperties properties, ObjectProvider<AutomationService> service,
                               AccountAuthorizer authorizer) {
        this.properties = properties;
        this.service = service;
        this.authorizer = authorizer;
    }

    @GetMapping
    public ResponseEntity<StatusResponse> status() {
        List<Long> own = authorizer.ownAccountIds();
        AutomationService running = service.getIfAvailable();

        List<StrategyView> strategies = properties.getStrategies().stream()
                .filter(definition -> definition != null && own.contains(definition.getAccountId()))
                .map(AutomationStatusController::view)
                .toList();
        List<ResultView> results = running == null ? List.<ResultView>of() : running.recentResults().stream()
                .filter(result -> own.contains(result.accountId()))
                .limit(50)
                .map(result -> new ResultView(result.strategyId(), result.symbol(), result.accountId(),
                        result.trigger().name(), result.outcome().name(), result.orderId(), result.detail(), result.at()))
                .toList();
        return ResponseEntity.ok(new StatusResponse(running != null, strategies, results));
    }

    private static StrategyView view(StrategyDefinition definition) {
        String parameters = definition.getType() == StrategyType.MA_CROSSOVER
                ? "short " + definition.getShortPeriod() + ", long " + definition.getLongPeriod()
                : "period " + definition.getPeriod() + ", multiplier " + definition.getMultiplier();
        return new StrategyView(definition.getId(), definition.getType() == null ? null : definition.getType().name(),
                definition.getAccountId(), definition.getSymbol() == null ? null : definition.getSymbol().toUpperCase(Locale.ROOT),
                definition.getQuantity(), definition.isEnabled(), parameters, StrategyDefinitionValidator.problems(definition));
    }
}
