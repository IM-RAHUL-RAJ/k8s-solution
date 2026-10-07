export type AdviceSignal = 'BUY' | 'SELL' | 'HOLD' | 'INSUFFICIENT_DATA';

/** One recommendation. Advice only: it never places an order. */
export interface TradeAdvice {
  symbol: string;
  signal: AdviceSignal;
  reasoning: string[];
  timestamp: string;
}

export type OrderOutcome = 'STRATEGY_TRIGGERED' | 'ORDER_SUBMITTED' | 'ORDER_REJECTED' | 'ORDER_SUBMISSION_FAILED';

export interface AutomationStrategy {
  id: string;
  type: 'MA_CROSSOVER' | 'BOLLINGER_BANDS' | null;
  accountId: number;
  symbol: string | null;
  quantity: number | null;
  enabled: boolean;
  parameters: string;
  problems: string[];
  /** Prices collected so far and prices needed before the rule can act (only while it is switched on). */
  collected: number | null;
  required: number | null;
}

export interface CreateStrategyRequest {
  type: 'MA_CROSSOVER' | 'BOLLINGER_BANDS';
  accountId: number;
  symbol: string;
  quantity: number;
  shortPeriod?: number;
  longPeriod?: number;
  period?: number;
  multiplier?: number;
}

export interface AutomationResult {
  strategyId: string;
  symbol: string;
  accountId: number;
  trigger: 'BUY' | 'SELL' | 'NONE';
  outcome: OrderOutcome;
  orderId: string | null;
  detail: string | null;
  at: string;
}

export interface AutomationStatus {
  running: boolean;
  strategies: AutomationStrategy[];
  results: AutomationResult[];
}
