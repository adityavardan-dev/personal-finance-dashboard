import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { SessionExpiryService, safeInternalReturnUrl } from './session-expiry.service';
import { AuthService } from '../../features/auth/auth';
import { API_CONFIG } from '../config/api.config';
import { BudgetStore } from '../budget/budget.store';
import { FinanceMetricsStore } from '../finance/finance-metrics.store';
import { ProfileStore } from '../profile/profile.store';

class SessionExpiryStub {
  handleUnauthorized = vi.fn();
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let expiry: SessionExpiryStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getAccessToken: () => 'token' } },
        { provide: SessionExpiryService, useClass: SessionExpiryStub },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    expiry = TestBed.inject(SessionExpiryService) as unknown as SessionExpiryStub;
  });

  afterEach(() => controller.verify());

  it('handles an authenticated 401 once and rethrows it', () => {
    let status = 0;
    http.get(`${API_CONFIG.baseUrl}/expenses`).subscribe({ error: (error) => status = error.status });
    const request = controller.expectOne(`${API_CONFIG.baseUrl}/expenses`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(expiry.handleUnauthorized).toHaveBeenCalledOnce();
    expect(status).toBe(401);
  });

  it('leaves auth-form 401 responses local', () => {
    http.post(`${API_CONFIG.baseUrl}/auth/login`, {}).subscribe({ error: () => undefined });
    controller.expectOne(`${API_CONFIG.baseUrl}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(expiry.handleUnauthorized).not.toHaveBeenCalled();
  });

  it('does not expire the session for non-401 responses', () => {
    http.get(`${API_CONFIG.baseUrl}/expenses/missing`).subscribe({ error: () => undefined });
    controller.expectOne(`${API_CONFIG.baseUrl}/expenses/missing`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(expiry.handleUnauthorized).not.toHaveBeenCalled();
  });
});

describe('session expiry safety', () => {
  it('accepts only internal return URLs', () => {
    expect(safeInternalReturnUrl('/history?filter=expense')).toBe('/history?filter=expense');
    expect(safeInternalReturnUrl('//attacker.example')).toBe('/dashboard');
    expect(safeInternalReturnUrl('https://attacker.example')).toBe('/dashboard');
  });

  it('deduplicates simultaneous browser expiry handling and clears every store', () => {
    const clearSession = vi.fn();
    const profileClear = vi.fn();
    const budgetClear = vi.fn();
    const metricsClear = vi.fn();
    const navigate = vi.fn(() => new Promise<boolean>(() => undefined));
    TestBed.configureTestingModule({
      providers: [
        SessionExpiryService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Router, useValue: { url: '/history', navigate } },
        { provide: AuthService, useValue: { clearSession } },
        { provide: ProfileStore, useValue: { clear: profileClear } },
        { provide: BudgetStore, useValue: { clear: budgetClear } },
        { provide: FinanceMetricsStore, useValue: { clear: metricsClear } },
      ],
    });
    const service = TestBed.inject(SessionExpiryService);
    service.handleUnauthorized();
    service.handleUnauthorized();
    expect(clearSession).toHaveBeenCalledOnce();
    expect(profileClear).toHaveBeenCalledOnce();
    expect(budgetClear).toHaveBeenCalledOnce();
    expect(metricsClear).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'session-expired', returnUrl: '/history' },
    });
  });

  it('does not navigate during server rendering', () => {
    const navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        SessionExpiryService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Router, useValue: { url: '/history', navigate } },
      ],
    });
    TestBed.inject(SessionExpiryService).handleUnauthorized();
    expect(navigate).not.toHaveBeenCalled();
  });
});
