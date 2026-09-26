import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BudgetStore } from '../../core/budget/budget.store';
import { FinanceMetricsStore } from '../../core/finance/finance-metrics.store';
import { InsightsComponent } from './insights';

const week = (label: string, friday: number, startDay: number) => ({ startDate: `2026-09-${String(startDay).padStart(2, '0')}`, endDate: `2026-09-${String(startDay + 6).padStart(2, '0')}`, label, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => ({ date: `2026-09-${String(startDay + index).padStart(2, '0')}`, label: day, amount: day === 'Fri' ? friday : 0 })) });
const metrics = signal<any>({
  asOfDate: '2026-09-26', currentMonthSpend: 300, previousMonthSpend: 100,
  monthComparison: { direction: 'up', percentageDelta: 200 }, budgetLimit: 1000, budgetRemaining: 700, budgetUsedPercentage: 30,
  averageDailySpend: 10, categories: [], insights: [{ severity: 'positive', title: 'On track', message: 'Within limits.' }],
  monthWeeks: [week('1 – 7 Sept', 100, 1), week('8 – 14 Sept', 200, 8)], currentWeek: [],
});

describe('InsightsComponent weekly pagination', () => {
  let fixture: ComponentFixture<InsightsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsightsComponent],
      providers: [provideRouter([]),
        { provide: BudgetStore, useValue: { currency: signal('INR') } },
        { provide: FinanceMetricsStore, useValue: { metrics, status: signal('loaded'), errorMessage: signal(null), load: vi.fn(), refresh: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();
  });

  it('shows daily bars and pages between weeks', () => {
    expect(fixture.nativeElement.textContent).toContain('1 – 7 Sept');
    expect(fixture.nativeElement.querySelector('[aria-label*="spent ₹100"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Spent ₹100');
    (fixture.nativeElement.querySelector('button[aria-label="Next week"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('8 – 14 Sept');
    expect(fixture.nativeElement.querySelector('[aria-label*="spent ₹200"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Spent ₹200');
  });
});
