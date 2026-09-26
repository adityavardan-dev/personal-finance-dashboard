import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { BudgetStore } from '../../../core/budget/budget.store';
import { BudgetEditorComponent } from './budget-editor';

describe('BudgetEditorComponent', () => {
  let fixture: ComponentFixture<BudgetEditorComponent>;
  const budget = signal<any>({ monthlyLimit: null, categoryLimits: [], currency: 'INR', createdAt: null, updatedAt: null });
  const status = signal<any>('loaded');
  const store = { budget, status, hasBudget: () => budget()?.monthlyLimit !== null, monthlyLimit: () => budget()?.monthlyLimit, save: vi.fn() };

  beforeEach(async () => {
    store.save.mockReturnValue(of({ ...budget(), monthlyLimit: 30000 }));
    await TestBed.configureTestingModule({ imports: [BudgetEditorComponent], providers: [{ provide: BudgetStore, useValue: store }] }).compileComponents();
    fixture = TestBed.createComponent(BudgetEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows setup form for a user without a budget', () => {
    expect(fixture.nativeElement.querySelector('#monthly-budget')).toBeTruthy();
  });

  it('saves a positive monthly budget', () => {
    const input = fixture.nativeElement.querySelector('#monthly-budget') as HTMLInputElement;
    input.value = '30000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(store.save).toHaveBeenCalledWith({ monthlyLimit: 30000, categoryLimits: [], currency: 'INR' });
  });
});
