export interface CurrencyConversionRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}

export interface CurrencyConversionResponse {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  rate: number;
}


export interface InstrumentInfo {
  symbol: string;
  name: string;
  exchange: string;
  assetClass: string;
  currency: string;
  tradable: boolean;
}

export interface WatchlistEntry extends InstrumentInfo {
  addedAt: string;
}
