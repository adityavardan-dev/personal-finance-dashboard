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
    const payload = { type: 'expense' as const, amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-17' };
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

  it('sends GET to /expenses/:id', () => {
    const mockExpense = { id: 'uuid-1', userId: 1, type: 'expense' as const, amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-17', createdAt: '' };

    service.getById('uuid-1').subscribe((result) => {
      expect(result.id).toBe('uuid-1');
    });

    const req = http.expectOne(`${API_URL}/uuid-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockExpense);
  });

  it('sends PATCH to /expenses/:id with the update payload', () => {
    const payload = { amount: 999, merchant: 'Updated' };
    const mockResponse = { id: 'uuid-1', userId: 1, type: 'expense' as const, amount: 999, category: 'Food & Dining', merchant: 'Updated', date: '2026-09-17', createdAt: '' };

    service.update('uuid-1', payload).subscribe((result) => {
      expect(result.amount).toBe(999);
    });

    const req = http.expectOne(`${API_URL}/uuid-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('sends DELETE to /expenses/:id', () => {
    const mockResponse = { id: 'uuid-1', userId: 1, type: 'expense' as const, amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-17', createdAt: '' };

    service.delete('uuid-1').subscribe((result) => {
      expect(result.id).toBe('uuid-1');
    });

    const req = http.expectOne(`${API_URL}/uuid-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(mockResponse);
  });
});
