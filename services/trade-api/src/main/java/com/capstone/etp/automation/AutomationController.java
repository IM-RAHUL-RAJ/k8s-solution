package com.capstone.etp.automation;

import com.capstone.etp.dto.InstrumentResponse;
import com.capstone.etp.exception.ModuleException;
import com.capstone.etp.security.AccountAuthorizer;
import com.capstone.etp.service.AccountService;
import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * A customer's automated strategies: create one (it starts OFF), switch it on or off, remove it, and see what it has done.
 * Switching ON is the one step that lets a rule place real orders, so it must carry an explicit acknowledgement.
 * Everything is limited to the accounts in the caller's own token; an administrator cannot manage orders.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/automation")
public class AutomationController {

    public record CreateRequest(@NotNull StrategyType type, @NotNull Long accountId, @NotNull String symbol,
                                @NotNull Integer quantity, Integer shortPeriod, Integer longPeriod,
                                Integer period, BigDecimal multiplier) {
    }

    public record EnabledRequest(@NotNull Boolean enabled, Boolean acknowledged) {
    }

    public record StrategyView(String id, String type, Long accountId, String symbol, Integer quantity,
                               boolean enabled, String parameters, List<String> problems,
                               Integer collected, Integer required) {
    }

    public record ResultView(String strategyId, String symbol, Long accountId, String trigger, String outcome,
                             UUID orderId, String detail, Instant at) {
    }

    public record StatusResponse(boolean running, List<StrategyView> strategies, List<ResultView> results) {
    }

    private final AutomationProperties properties;
    private final AutomationMapper store;
    private final AutomationService service;
    private final AccountAuthorizer authorizer;
    private final AccountService accounts;

    AutomationController(AutomationProperties properties, AutomationMapper store, AutomationService service,
                         AccountAuthorizer authorizer, AccountService accounts) {
        this.properties = properties;
        this.store = store;
        this.service = service;
        this.authorizer = authorizer;
        this.accounts = accounts;
    }

    @GetMapping
    public ResponseEntity<StatusResponse> status() {
        List<Long> own = authorizer.ownAccountIds();
        List<StrategyView> strategies = new ArrayList<>();
        for (Long accountId : own) {
            for (StrategyDefinition definition : store.findByAccount(accountId)) {
                strategies.add(view(definition));
            }
        }
        List<ResultView> results = service.recentResults().stream()
                .filter(result -> own.contains(result.accountId()))
                .limit(50)
                .map(result -> new ResultView(result.strategyId(), result.symbol(), result.accountId(),
                        result.trigger().name(), result.outcome().name(), result.orderId(), result.detail(), result.at()))
                .toList();
        return ResponseEntity.ok(new StatusResponse(properties.isEnabled(), strategies, results));
    }

    /** Creates a strategy, switched OFF. */
    @PostMapping("/strategies")
    public ResponseEntity<StrategyView> create(@Valid @RequestBody CreateRequest request) {
        authorizer.ensureOrderManagementAllowed();
        authorizer.ensureOwnAccount(request.accountId());

        StrategyDefinition definition = new StrategyDefinition();
        definition.setId("new");
        definition.setType(request.type());
        definition.setAccountId(request.accountId());
        definition.setSymbol(request.symbol() == null ? null : request.symbol().trim().toUpperCase(Locale.ROOT));
        definition.setQuantity(request.quantity());
        definition.setShortPeriod(request.shortPeriod());
        definition.setLongPeriod(request.longPeriod());
        definition.setPeriod(request.period());
        definition.setMultiplier(request.multiplier());
        List<String> problems = StrategyDefinitionValidator.problems(definition);
        if (!problems.isEmpty()) {
            throw new ModuleException(HttpStatus.UNPROCESSABLE_ENTITY, "VAL-422", String.join("; ", problems));
        }
        if (accounts.getInstruments().stream().map(InstrumentResponse::getSymbol).noneMatch(definition.getSymbol()::equals)) {
            throw new ModuleException(HttpStatus.UNPROCESSABLE_ENTITY, "VAL-422", "That instrument is not one we trade");
        }
        int needed = StrategyFactory.create(definition).requiredObservations();
        if (needed > properties.getHistorySize()) {
            throw new ModuleException(HttpStatus.UNPROCESSABLE_ENTITY, "VAL-422", "Those periods are longer than the price history we keep");
        }

        Long id = store.insertWithinCap(definition.getAccountId(), definition.getType().name(), definition.getSymbol(),
                definition.getQuantity(), definition.getShortPeriod(), definition.getLongPeriod(), definition.getPeriod(),
                definition.getMultiplier(), properties.getMaxPerAccount());
        if (id == null) {
            throw new ModuleException(HttpStatus.UNPROCESSABLE_ENTITY, "AUT-422",
                    "An account can hold up to " + properties.getMaxPerAccount() + " strategies. Remove one first");
        }
        log.info("[AUTOMATION] strategy created id={} accountId={} symbol={} type={} (off)", id, definition.getAccountId(),
                definition.getSymbol(), definition.getType());
        return ResponseEntity.status(HttpStatus.CREATED).body(view(store.findById(id)));
    }

    /** Switches a strategy on or off. Switching ON needs acknowledged=true. */
    @PutMapping("/strategies/{id}/enabled")
    public ResponseEntity<StrategyView> setEnabled(@PathVariable Long id, @Valid @RequestBody EnabledRequest request) {
        authorizer.ensureOrderManagementAllowed();
        StrategyDefinition definition = owned(id);
        if (request.enabled()) {
            if (!Boolean.TRUE.equals(request.acknowledged())) {
                throw new ModuleException(HttpStatus.UNPROCESSABLE_ENTITY, "AUT-422",
                        "Confirm that you understand this strategy will place real orders");
            }
            if (!properties.isEnabled()) {
                throw new ModuleException(HttpStatus.CONFLICT, "AUT-409", "Automated trading is switched off on this platform");
            }
            List<String> problems = StrategyDefinitionValidator.problems(definition);
            if (!problems.isEmpty()) {
                throw new ModuleException(HttpStatus.UNPROCESSABLE_ENTITY, "VAL-422", String.join("; ", problems));
            }
        }
        store.setEnabled(id, request.enabled());
        service.reload();
        log.info("[AUTOMATION] strategy {} id={} accountId={}", request.enabled() ? "switched ON" : "switched off", id, definition.getAccountId());
        return ResponseEntity.ok(view(store.findById(id)));
    }

    @DeleteMapping("/strategies/{id}")
    public ResponseEntity<Void> remove(@PathVariable Long id) {
        authorizer.ensureOrderManagementAllowed();
        StrategyDefinition definition = owned(id);
        store.delete(id);
        service.reload();
        log.info("[AUTOMATION] strategy removed id={} accountId={}", id, definition.getAccountId());
        return ResponseEntity.noContent().build();
    }

    /** The strategy, which must belong to one of the caller's accounts. Anyone else's looks like it does not exist. */
    private StrategyDefinition owned(Long id) {
        StrategyDefinition definition = store.findById(id);
        if (definition == null || !authorizer.ownAccountIds().contains(definition.getAccountId())) {
            throw new ModuleException(HttpStatus.NOT_FOUND, "AUT-404", "That strategy does not exist");
        }
        return definition;
    }

    private StrategyView view(StrategyDefinition definition) {
        String parameters = definition.getType() == StrategyType.MA_CROSSOVER
                ? "short " + definition.getShortPeriod() + ", long " + definition.getLongPeriod()
                : "period " + definition.getPeriod() + ", multiplier " + definition.getMultiplier();
        var progress = definition.isEnabled() ? service.progressOf(definition.getId()) : java.util.Optional.<AutomationService.Progress>empty();
        return new StrategyView(definition.getId(), definition.getType() == null ? null : definition.getType().name(),
                definition.getAccountId(), definition.getSymbol(), definition.getQuantity(), definition.isEnabled(),
                parameters, StrategyDefinitionValidator.problems(definition),
                progress.map(AutomationService.Progress::collected).orElse(null),
                progress.map(AutomationService.Progress::required).orElse(null));
    }
}
