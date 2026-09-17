import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let http: HttpTestingController;

  const API_URL = 'http://127.0.0.1:3000/expenses';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ExpenseService],
    });
    service = TestBed.inject(ExpenseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends POST to /expenses with the correct payload', () => {
    const payload = { amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-17' };
    const mockResponse = { id: 'uuid-1', userId: 1, createdAt: '2026-09-17T10:00:00.000Z', ...payload };

    service.create(payload).subscribe((result) => {
      expect(result.id).toBe('uuid-1');
    });

    const req = http.expectOne(API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('sends GET to /expenses for list', () => {
    service.list().subscribe();

    const req = http.expectOne(API_URL);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
