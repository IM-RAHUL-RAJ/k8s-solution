export interface PortfolioSummary {
  accountId: number;
  baseCurrency: string;
  cashBalance: number;
  marketValue: number;
  costBasis: number;
  unrealisedPnl: number;
  unrealisedPnlPercent: number | null;
  realisedPnl: number;
  totalValue: number;
  positionCount: number;
  partial: boolean;
  asOf: string;
}

export interface PricedPosition {
  accountId: number;
  symbol: string;
  quantity: number;
  averageCost: number;
  costBasis: number;
  lastPrice: number | null;
  marketValue: number | null;
  unrealisedPnl: number | null;
  unrealisedPnlPercent: number | null;
  currency: string;
  priceAsOf: string | null;
  stale: boolean;
}

export interface SymbolPnl {
  symbol: string;
  realisedPnl: number;
  unrealisedPnl: number;
  totalPnl: number;
}

export interface PnlResponse {
  accountId: number;
  baseCurrency: string;
  from: string | null;
  to: string | null;
  realisedPnl: number;
  unrealisedPnl: number;
  totalPnl: number;
  bySymbol?: SymbolPnl[];
  asOf: string;
}
