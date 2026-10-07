import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../config/api-endpoints';

/** The sizes of bar the platform can serve. */
export type CandlePeriod = '1d' | '4h' | '1h' | '15m';

/** What the chart offers: one day, one month, three months. */
export type CandlePreset = '1D' | '1M' | '3M';

export const CANDLE_PRESETS: ReadonlyArray<{ value: CandlePreset; label: string; period: CandlePeriod; bars: number; intraday: boolean }> = [
  // Today: 15-minute bars, about a trading session's worth
  { value: '1D', label: '1 Day', period: '15m', bars: 32, intraday: true },
  // A month and three months: one bar a day
  { value: '1M', label: '1 Month', period: '1d', bars: 31, intraday: false },
  { value: '3M', label: '3 Months', period: '1d', bars: 92, intraday: false }
];

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface CandlesResponse {
  symbol: string;
  currency: string | null;
  period: CandlePeriod;
  candles: Candle[];
  asOf: string;
}

/** Candles for the watchlist chart. They come through the platform, so the market-data key never reaches the browser. */
@Injectable({ providedIn: 'root' })
export class CandlesService {
  private readonly http = inject(HttpClient);

  getCandles(symbol: string, period: CandlePeriod = '1d', days = 30): Observable<CandlesResponse> {
    return this.http.get<CandlesResponse>(
      `${API_ENDPOINTS.tradeApiBase}/api/v1/quotes/candles/${encodeURIComponent(symbol)}`,
      { params: { period, limit: days } }
    );
  }
}
