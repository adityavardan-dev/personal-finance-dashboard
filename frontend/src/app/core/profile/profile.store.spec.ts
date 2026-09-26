import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { BudgetStore } from '../budget/budget.store';
import { initialsFromUsername } from './profile.models';
import { ProfileService } from './profile.service';
import { ProfileStore } from './profile.store';

const profile = { id: 1, username: 'River Stone', email: 'different.prefix@example.com', preferences: { currency: 'INR' as const, theme: 'system' as const } };
describe('ProfileStore', () => {
  let store: ProfileStore; let service: any; const budgetStore = { clear: vi.fn(), load: vi.fn() };
  beforeEach(() => { service = { getMine: vi.fn().mockReturnValue(of(profile)), updatePreferences: vi.fn() }; TestBed.configureTestingModule({ providers: [{ provide: ProfileService, useValue: service }, { provide: BudgetStore, useValue: budgetStore }] }); store = TestBed.inject(ProfileStore); });
  it('loads exact persisted identity and initials', () => { store.load(); expect(store.profile()?.username).toBe('River Stone'); expect(store.initials()).toBe('RS'); });
  it('persists currency and refreshes budget state', () => { service.updatePreferences.mockReturnValue(of({ preferences: { currency: 'USD', theme: 'system' } })); store.load(); store.updateCurrency('USD').subscribe(); expect(store.profile()?.preferences.currency).toBe('USD'); expect(budgetStore.clear).toHaveBeenCalled(); expect(budgetStore.load).toHaveBeenCalled(); });
  it('exposes load failure without fallback identity', () => { service.getMine.mockReturnValue(throwError(() => new Error('offline'))); store.load(); expect(store.status()).toBe('error'); expect(store.profile()).toBeNull(); });
  it.each([['Aditya Vardan', 'AV'], ['Prince', 'P'], ['  Mary   Jane Watson ', 'MJ'], ['', 'U']])('derives initials for %s', (name, expected) => expect(initialsFromUsername(name)).toBe(expected));
});
