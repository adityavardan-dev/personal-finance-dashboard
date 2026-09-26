import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BudgetService } from './budget.service';

describe('BudgetService', () => {
  let service: BudgetService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BudgetService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the authenticated user budget', () => {
    service.getMine().subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/budgets/me'));
    expect(request.request.method).toBe('GET');
    request.flush({ monthlyLimit: null, categoryLimits: [], currency: 'INR', createdAt: null, updatedAt: null });
  });

  it('replaces the authenticated user budget', () => {
    const payload = { monthlyLimit: 30000, categoryLimits: [], currency: 'INR' as const };
    service.saveMine(payload).subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/budgets/me'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({ ...payload, createdAt: 'a', updatedAt: 'a' });
  });
});
