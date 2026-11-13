import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BudgetStore } from '../../core/budget/budget.store';
import { FinanceMetricsStore } from '../../core/finance/finance-metrics.store';
import { DashboardComponent } from './dashboard';

const metrics = {
  currentMonthSpend: 500,
  sixMonthTrend: [{ year: 2026, month: 9, label: 'Sept', amount: 500 }],
  insights: [{ code: 'WITHIN_BUDGET', severity: 'positive', title: 'Budget is on track', message: 'Within limits.' }],
};

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: any;
  const metricsSignal = signal<any>(metrics);
  const metricsStore = { metrics: metricsSignal, status: signal('loaded'), errorMessage: signal(null), load: vi.fn(), refresh: vi.fn() };
  const budgetStore = { budget: signal(null), status: signal('loaded'), hasBudget: signal(false), monthlyLimit: signal(1000), currency: signal('INR'), load: vi.fn(), save: vi.fn() };

  beforeEach(async () => {
    metricsSignal.set(metrics);
    metricsStore.load.mockClear();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), { provide: FinanceMetricsStore, useValue: metricsStore }, { provide: BudgetStore, useValue: budgetStore }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance as any;
    fixture.detectChanges();
  });

  it('loads the shared metrics source', () => {
    expect(metricsStore.load).toHaveBeenCalledTimes(1);
  });

  it('renders current-month spend from shared metrics', () => {
    expect(component.totalSpent()).toBe(500);
    expect(fixture.nativeElement.querySelector('app-hero-card')).toBeTruthy();
  });

  it('provides dynamic trend points and deterministic insight', () => {
    expect(component.trend()).toEqual(metrics.sixMonthTrend);
    expect(component.primaryInsight()?.code).toBe('WITHIN_BUDGET');
  });

  it('links to split groups and keeps transaction history accessible', () => {
    const card = fixture.nativeElement.querySelector('.peer-dashboard-card') as HTMLElement;
    expect(card.querySelector('a[href="/peer-splits"]')).toBeTruthy();
    expect(card.querySelector('a[href="/history"]')).toBeTruthy();
  });

  it('handles empty metrics', () => {
    metricsSignal.set(null);
    expect(component.totalSpent()).toBe(0);
    expect(component.trend()).toEqual([]);
  });
});
