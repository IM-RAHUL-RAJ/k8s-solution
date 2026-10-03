import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../config/api-endpoints';
import { AdminAccountSummary, RegistrationRequest, RegistrationResponse } from '../models/admin.model';

/** Admin-only endpoints of the trade API. The API refuses anyone without the ADMIN role. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  listAccounts(): Observable<AdminAccountSummary[]> {
    return this.http.get<AdminAccountSummary[]>(`${API_ENDPOINTS.tradeApiBase}/api/v1/admin/accounts`);
  }

  /** Opens the client and account, creates the login, and has the auth service email the default password. */
  register(request: RegistrationRequest): Observable<RegistrationResponse> {
    return this.http.post<RegistrationResponse>(`${API_ENDPOINTS.tradeApiBase}/api/v1/admin/registrations`, request);
  }
}
