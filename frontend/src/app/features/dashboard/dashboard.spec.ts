import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DashboardComponent } from './dashboard';
import { ExpenseService } from '../expenses/expense.service';

const mockExpenses = [
  { id: 'a', userId: 1, amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-16', createdAt: '2026-09-16T10:00:00.000Z' },
  { id: 'b', userId: 1, amount: 1200, category: 'Shopping', merchant: 'Amazon', date: '2026-09-17', createdAt: '2026-09-17T11:00:00.000Z' },
];

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let c: any;
  let mockList: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockList = vi.fn().mockReturnValue(of(mockExpenses));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: ExpenseService, useValue: { list: mockList, create: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    c = fixture.componentInstance as any;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(c).toBeTruthy();
  });

  // --- Signal state ---

  it('totalSpent calculates sum of all expense amounts', () => {
    expect(c.totalSpent()).toBe(1700);
  });

  it('recentTransactions is newest-first', () => {
    expect(c.recentTransactions()).toHaveLength(2);
    expect(c.recentTransactions()[0].merchant).toBe('Amazon');
    expect(c.recentTransactions()[1].merchant).toBe('Swiggy');
  });

  it('all recent transactions have type debit', () => {
    expect(c.recentTransactions().every((t: any) => t.type === 'debit')).toBe(true);
  });

  it('limits recentTransactions to 5 even when more expenses exist', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`, userId: 1, amount: 100, category: 'Other',
      merchant: `Merchant ${i}`, date: '2026-09-17', createdAt: '',
    }));
    mockList.mockReturnValue(of(many));
    const f2 = TestBed.createComponent(DashboardComponent);
    const c2 = f2.componentInstance as any;
    f2.detectChanges();
    await f2.whenStable();
    f2.detectChanges();
    expect(c2.recentTransactions()).toHaveLength(5);
  });

  it('handles empty expense list without crashing', async () => {
    mockList.mockReturnValue(of([]));
    const f2 = TestBed.createComponent(DashboardComponent);
    const c2 = f2.componentInstance as any;
    f2.detectChanges();
    await f2.whenStable();
    f2.detectChanges();
    expect(c2.totalSpent()).toBe(0);
    expect(c2.recentTransactions()).toHaveLength(0);
  });

  it('handles API failure without crashing', async () => {
    mockList.mockReturnValue(throwError(() => new Error('Network error')));
    const f2 = TestBed.createComponent(DashboardComponent);
    f2.detectChanges();
    await f2.whenStable();
    f2.detectChanges();
    expect(f2.componentInstance).toBeTruthy();
  });

  // --- DOM rendering ---

  it('Dashboard renders the calculated spending via HeroCard binding', () => {
    expect(fixture.nativeElement.querySelector('app-hero-card')).toBeTruthy();
    expect(c.totalSpent()).toBe(1700);
  });

  it('RecentActivity receives the returned transactions via signal binding', () => {
    expect(fixture.nativeElement.querySelector('app-recent-activity')).toBeTruthy();
    expect(c.recentTransactions()).toHaveLength(2);
  });
});
