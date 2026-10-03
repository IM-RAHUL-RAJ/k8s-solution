import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../config/api-endpoints';
import { InstrumentInfo, WatchlistEntry } from '../models/instrument.model';

@Injectable({ providedIn: 'root' })
export class InstrumentService {
  private readonly http = inject(HttpClient);

  getInstruments(): Observable<InstrumentInfo[]> {
    return this.http.get<InstrumentInfo[]>(`${API_ENDPOINTS.tradeApiBase}/api/v1/instruments`);
  }

  getWatchlist(accountId: number): Observable<WatchlistEntry[]> {
    return this.http.get<WatchlistEntry[]>(`${API_ENDPOINTS.tradeApiBase}/api/v1/accounts/${accountId}/watchlist`);
  }

  /** Idempotent. Answers with the whole watchlist as it now stands. */
  addToWatchlist(accountId: number, symbol: string): Observable<WatchlistEntry[]> {
    return this.http.put<WatchlistEntry[]>(
      `${API_ENDPOINTS.tradeApiBase}/api/v1/accounts/${accountId}/watchlist/${encodeURIComponent(symbol)}`,
      null
    );
  }

  removeFromWatchlist(accountId: number, symbol: string): Observable<WatchlistEntry[]> {
    return this.http.delete<WatchlistEntry[]>(
      `${API_ENDPOINTS.tradeApiBase}/api/v1/accounts/${accountId}/watchlist/${encodeURIComponent(symbol)}`
    );
  }
}
