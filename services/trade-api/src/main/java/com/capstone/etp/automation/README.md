# Automated Trading

> **Automation executes configured rules through the existing Trade REST API and must remain subject to the platform's authentication, authorization, suitability and risk controls.**

## Purpose

Runs deterministic strategies against the real-time price stream. When a rule triggers it places an order by calling `POST /api/v1/orders` on the Trade REST API, exactly as a customer's browser would. It never writes to the orders table, never calls `OrderService` directly and never publishes to the execution topic itself, so order validation, authorisation, Kafka publishing and the executor stay the single source of truth.

It is **off by default**.

## Architecture

```
market-data topic ──> MarketDataConsumer ──> QuoteObserver
                                                  │
                                         AutomationService
                                                  │  PriceHistory (bounded, per symbol)
                                                  ▼
                                   TradingStrategy (MA crossover | Bollinger)
                                                  │  StrategySignal (BUY | SELL | NONE)
                                                  ▼
                                 order request ──> TradeApiClient (RestTradeApiClient)
                                                  ▼
                              POST /api/v1/orders  (existing)  ──> Kafka ──> Executor
```

The price stream is the existing `market-data` topic: the `MarketQuote` payload (`symbol`, `price`, `quoteAsOf`, ...). No second format was invented.

## Strategies

Each is stateless: a trigger is a **transition between the last two observations**.

### `MA_CROSSOVER`

| Trigger | Condition |
|---|---|
| BUY | previous short MA ≤ previous long MA **and** current short MA > current long MA |
| SELL | previous short MA ≥ previous long MA **and** current short MA < current long MA |

"Short MA above long MA" alone triggers nothing. Needs `longPeriod + 1` observations.

### `BOLLINGER_BANDS`

`middle` = moving average over `period`; `upper` = middle + `multiplier` × σ; `lower` = middle − `multiplier` × σ (population σ).

| Trigger | Condition |
|---|---|
| BUY | price crosses **below** the lower band: previous price ≥ previous lower band and price < lower band |
| SELL | price crosses **above** the upper band: previous price ≤ previous upper band and price > upper band |

While the price stays outside the band, later ticks trigger nothing. Needs `period + 1` observations.

To add a strategy: implement `TradingStrategy`, add a `StrategyType` and a case in `StrategyFactory`.

## Configuration

```
app.automation.enabled=true                     # AUTOMATION_ENABLED, default false
app.automation.trade-api-base-url=http://localhost:8084   # AUTOMATION_TRADE_API_URL
app.automation.service-token=<JWT>              # AUTOMATION_SERVICE_TOKEN
app.automation.connect-timeout-ms=2000
app.automation.read-timeout-ms=4000
app.automation.history-size=500                 # prices kept per symbol

app.automation.strategies[0].id=aapl-ma
app.automation.strategies[0].type=MA_CROSSOVER
app.automation.strategies[0].account-id=1
app.automation.strategies[0].symbol=AAPL
app.automation.strategies[0].quantity=100
app.automation.strategies[0].short-period=20
app.automation.strategies[0].long-period=50
app.automation.strategies[0].enabled=true       # default false

app.automation.strategies[1].id=msft-bollinger
app.automation.strategies[1].type=BOLLINGER_BANDS
app.automation.strategies[1].account-id=1
app.automation.strategies[1].symbol=MSFT
app.automation.strategies[1].quantity=10
app.automation.strategies[1].period=20
app.automation.strategies[1].multiplier=2
app.automation.strategies[1].enabled=true
```

## Safety

- Nothing trades unless `app.automation.enabled=true`, the strategy is `enabled=true`, and the definition is valid (id, type, `accountId` ≥ 1, symbol, `quantity` ≥ 1, parameters in range). A bad or disabled strategy is logged and left out.
- The token is a customer's JWT for the account the strategy trades; the Trade API applies its normal checks. Without a token nothing is sent.
- **One attempt per trigger.** A failure is logged and recorded, never retried, so an unknown outcome cannot become two orders.
- The idempotency key is derived from `strategy + symbol + side + quote time`, so the same trigger can never be accepted twice by the platform.
- A quote that is not newer than the last one stored for the symbol is not a new observation, so a quote delivered twice is one tick.
- Malformed events (no symbol, no or non-positive price) are ignored with a warning.
- History is bounded (`history-size`) and kept only for symbols that have a strategy.

## Outcomes

| Outcome | Meaning |
|---|---|
| `STRATEGY_TRIGGERED` | the rule fired; no trade yet |
| `ORDER_SUBMITTED` | the Trade API accepted the order (the executor still decides if it fills) |
| `ORDER_REJECTED` | the Trade API said no (4xx) |
| `ORDER_SUBMISSION_FAILED` | unreachable, timed out or 5xx: the outcome is unknown |

Logs (`[AUTOMATION] event=... strategy=... symbol=... accountId=... trigger=... orderId=... at=...`) are written for every evaluation (debug), trigger, submission attempt, success and failure.

Example trigger and order:

```
[AUTOMATION] event=STRATEGY_TRIGGERED strategy=aapl-ma symbol=AAPL accountId=1 trigger=BUY at=2026-10-07T10:00:05Z
             reason=short MA crossed above long MA (short MA 10.0000 -> 11.0000, long MA 10.0000 -> 10.5000)
POST /api/v1/orders  {"accountId":1,"symbol":"AAPL","side":"BUY","quantity":100,"price":12.00,"idempotencyKey":"..."}
[AUTOMATION] event=ORDER_SUBMITTED strategy=aapl-ma symbol=AAPL accountId=1 trigger=BUY orderId=... 
```

## Assumptions and limits

- The order `price` is the quote price and is sent as the limit price; the Trade API converts it for the instrument. Configure strategies for accounts whose currency matches the instrument.
- The service token is a normal JWT and expires like one; renew it and restart. There is no service-account type in the platform yet.
- History starts empty on start-up and fills from live quotes; a strategy is silent until it has enough observations.
- The strategy runs in the trade-api process (as the other extension modules do), on the market-data consumer; orders are submitted on one dedicated thread.

## Run and test

```
AUTOMATION_ENABLED=true AUTOMATION_SERVICE_TOKEN=<jwt> mvn spring-boot:run
mvn test -Dtest='StrategiesTest,AutomationServiceTest,RestTradeApiClientTest,AutomationWiringTest'
```
