import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../config/api-endpoints';

export type CandlePeriod = '1d' | '4h' | '1h' | '15m';

export const CANDLE_PERIODS: ReadonlyArray<{ value: CandlePeriod; label: string }> = [
  { value: '1d', label: '1D' },
  { value: '4h', label: '4H' },
  { value: '1h', label: '1H' },
  { value: '15m', label: '15M' }
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
