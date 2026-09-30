---
name: angular-trading-ui
description: "Use when working on Angular 21 files in sprint-09-trading-ui: component design, service patterns, interceptor structure, route guards, form validation, and testing. Enforces typed clients, standalone components, signals, and security-first patterns."
applyTo: "sprint-09-trading-ui/src/**/*.ts"
---

# Angular Trading UI File Instructions

## Apply These Patterns to All TypeScript Files

### Components
- **Standalone**: Use `@Component({ standalone: true, ... })`
- **Signals**: Replace `BehaviorSubject` with `signal()` and derived signals
- **No NgModule**: Everywhere you see `@NgModule`, that's a smell
- **Imports array**: Import only what this component uses (standalone pattern)
- **Change detection**: Default to `ChangeDetectionStrategy.OnPush` with signals

```typescript
// ✅ CORRECT
@Component({
  selector: 'app-order-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TradeClientModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`,
  styles: [`...`]
})
export class OrderTicketComponent {
  orderForm = signal<FormGroup>(this.fb.group({ ... }));
  isSubmitting = signal(false);
  
  constructor(private fb: FormBuilder, private tradeClient: TradeClientService) {}
  
  onSubmit() {
    this.isSubmitting.set(true);
    this.tradeClient.placeOrder(this.orderForm().value)
      .subscribe({
        next: () => this.isSubmitting.set(false),
        error: () => this.isSubmitting.set(false)
      });
  }
}
```

```typescript
// ❌ WRONG
import { NgModule } from '@angular/core';

@NgModule({
  declarations: [OrderTicketComponent],
  imports: [CommonModule, ReactiveFormsModule]
})
export class OrderModule { }
```

### Services
- **Inject via `inject()`**, not constructor parameters (cleaner signals integration)
- **Return typed Observables** from `HttpClient` (type-safe from generated clients)
- **No state in services** except through `signal()` (composable with components)
- **Handle errors explicitly**: Never swallow exceptions silently

```typescript
// ✅ CORRECT
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  currentUser = signal<User | null>(null);
  isAuthenticated = computed(() => this.currentUser() !== null);
  
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/auth/login', credentials)
      .pipe(
        tap(response => {
          this.currentUser.set(response.user);
          localStorage.setItem('token', response.token);
        }),
        catchError(err => {
          console.error('Login failed:', err.message);
          return throwError(() => new Error('Invalid credentials'));
        })
      );
  }
  
  logout() {
    this.currentUser.set(null);
    localStorage.removeItem('token');
    this.router.navigate(['/sign-in']);
  }
}
```

### Interceptors (Security Critical)
- **Registered once** in root config
- **Explicit allow-list** for token attachment (never deny-list)
- **Never attach to third-party origins**
- **Test both attach and do-not-attach cases**

```typescript
// ✅ CORRECT
export function authInterceptor(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  const allowedOrigins = environment.apiOrigins; // ['https://api.platform.com', 'https://auth.platform.com']
  
  const isOwnOrigin = allowedOrigins.some(origin => req.url.startsWith(origin));
  
  if (isOwnOrigin) {
    const authService = inject(AuthService);
    const token = authService.getToken();
    
    if (token) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }
  }
  
  return next.handle(req);
}

// In main.ts
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
});
```

### Route Guards (Usability Control)
- **Check authentication** on every route except `/sign-in`
- **Redirect with return address** (carry where user was going)
- **Validate return URL** against this origin only (prevent open redirect)
- **Render error messages** (don't hide auth failures)

```typescript
// ✅ CORRECT
export const authGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.isAuthenticated()) {
    return true;
  }
  
  // Parse return URL
  const url = new URL(state.url, window.location.origin);
  const returnUrl = url.pathname + url.search;
  
  // Only allow return to paths on this origin
  if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    return router.createUrlTree(['/sign-in'], { 
      queryParams: { returnUrl } 
    });
  }
  
  return router.createUrlTree(['/sign-in']);
};

// In routing
export const routes: Routes = [
  { path: 'sign-in', component: SignInComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'orders', component: BlotterComponent, canActivate: [authGuard] },
  { path: 'order-ticket', component: OrderTicketComponent, canActivate: [authGuard] }
];
```

### Forms (Validation Pattern)
- **Reactive Forms** throughout (type-safe, testable)
- **Validation at the form level** (not scattered in directives)
- **Error messages tied to form state** (clear feedback to user)
- **Quantity, Price, Symbol, Account validation** per contract

```typescript
// ✅ CORRECT
@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <input formControlName="symbol" placeholder="Symbol" />
      <span *ngIf="symbolError()">{{ symbolError() }}</span>
      
      <input formControlName="quantity" type="number" />
      <span *ngIf="quantityError()">{{ quantityError() }}</span>
      
      <input formControlName="price" type="number" step="0.01" />
      <span *ngIf="priceError()">{{ priceError() }}</span>
      
      <input formControlName="account" [value]="currentAccount()" disabled />
      
      <button [disabled]="form.invalid">Submit Order</button>
    </form>
  `
})
export class OrderFormComponent {
  form = signal(this.fb.group({
    symbol: ['', [Validators.required, Validators.pattern(/^[A-Z]{1,10}$/)]],
    quantity: ['', [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    price: ['', [Validators.required, Validators.min(0.01), this.maxTwoDecimalPlaces]],
    account: [{ value: '', disabled: true }, Validators.required],
    side: ['BUY', Validators.required]
  }));
  
  symbolError = computed(() => {
    const control = this.form().get('symbol');
    return control?.hasError('required') ? 'Symbol required' : 
           control?.hasError('pattern') ? 'Invalid symbol format' : '';
  });
  
  onSubmit() {
    if (this.form().valid) {
      // Submit to API
    }
  }
  
  private maxTwoDecimalPlaces: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const match = control.value.toString().match(/^\d+(\.\d{1,2})?$/);
    return match ? null : { maxDecimals: true };
  };
}
```

### Testing
- **Arrange-Act-Assert** pattern for all tests
- **Test observable subscriptions** with `fakeAsync`, `tick()`, or `done()` callback
- **Mock HttpClient** with `HttpTestingController`
- **Named test cases** for interceptor (attach/do-not-attach)
- **No actual HTTP calls** in unit tests

```typescript
// ✅ CORRECT
describe('AuthInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        { provide: AuthService, useValue: { getToken: () => 'test-token' } }
      ]
    });
    
    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });
  
  afterEach(() => httpMock.verify());
  
  it('should attach bearer token to own API requests', () => {
    httpClient.get('/api/v1/orders').subscribe();
    
    const req = httpMock.expectOne('/api/v1/orders');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
  });
  
  it('should NOT attach bearer token to third-party requests', () => {
    httpClient.get('https://third-party.com/data').subscribe();
    
    const req = httpMock.expectOne('https://third-party.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
  });
});
```

### Generated Client Usage
- **Never import types directly from generated tree**. Wrap in services.
- **Generated code is machine output**: Never edit it, always regenerate.
- **Use wrapper services** for domain-specific logic outside the generated tree.

```typescript
// ✅ CORRECT
// src/services/trade-client-wrapper.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TradeApiClient } from '../generated/trade-api/api.service'; // OK to use from generated
import { Order, PlaceOrderRequest } from '../generated/trade-api/models';

@Injectable({ providedIn: 'root' })
export class TradeClientService {
  constructor(
    private http: HttpClient,
    private tradeApiClient: TradeApiClient
  ) {}
  
  placeOrder(request: PlaceOrderRequest): Observable<Order> {
    // Business logic wrapping generated client
    return this.tradeApiClient.placeOrder(request)
      .pipe(
        tap(order => console.log('Order placed:', order.id)),
        catchError(err => this.handleOrderError(err))
      );
  }
  
  private handleOrderError(err: any): Observable<never> {
    const message = err.status === 400 ? 'Invalid order parameters' : 'Order submission failed';
    return throwError(() => new Error(message));
  }
}
```

## Environment Configuration
- **All URLs come from `environment.ts`**, never hardcoded
- **Keep `.env.example` committed** (template for secrets)
- **Never commit `.env` or `.env.local`**
- **Set `environment.apiOrigins` for token attachment**

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiOrigins: [
    'http://localhost:3000',        // Trade API
    'http://localhost:3001'         // Auth Service
  ],
  authServiceUrl: 'http://localhost:3001',
  tradeApiUrl: 'http://localhost:3000'
};
```

## Summary: Forbidden vs. Required

| Forbidden | Required |
|-----------|----------|
| `@NgModule` anywhere | `standalone: true` on every component |
| `BehaviorSubject` in components | `signal()` and derived signals |
| `constructor(private service)` in components | `inject(Service)` pattern |
| Hand-written HTTP clients | Generated from contracts only |
| Multiple places setting Authorization header | One interceptor, registered once |
| Deny-list for token attachment | Allow-list only |
| Third-party token attachment | Platform APIs only |
| `localStorage` without token refresh | Refresh token rotation before expiry |
| Unauthenticated routes with empty screens | Redirect to sign-in with return address |
| Hardcoded URLs | Environment configuration only |
| Skipping interceptor/guard tests | Named test cases (attach/do-not-attach) |

