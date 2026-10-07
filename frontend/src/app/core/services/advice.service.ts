import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../config/api-endpoints';
import { AutomationStatus, TradeAdvice } from '../models/advice.model';

/** Trade advice (recommendations only) and the read-only status of automated trading. */
@Injectable({ providedIn: 'root' })
export class AdviceService {
  private readonly http = inject(HttpClient);

  advice(accountId: number): Observable<TradeAdvice[]> {
    return this.http.get<TradeAdvice[]>(`${API_ENDPOINTS.tradeApiBase}/api/v1/trade-advice`, { params: { accountId } });
  }

  automationStatus(): Observable<AutomationStatus> {
    return this.http.get<AutomationStatus>(`${API_ENDPOINTS.tradeApiBase}/api/v1/automation`);
  }
}
