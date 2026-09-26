import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, tap } from 'rxjs';
import { BudgetStore } from '../budget/budget.store';
import { CurrencyCode } from '../budget/budget.models';
import { initialsFromUsername, UserPublicProfile } from './profile.models';
import { ProfileService } from './profile.service';

export type ProfileStatus = 'idle' | 'loading' | 'loaded' | 'saving' | 'error';

@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly service = inject(ProfileService);
  private readonly budgetStore = inject(BudgetStore);
  private readonly profileState = signal<UserPublicProfile | null>(null);
  private readonly statusState = signal<ProfileStatus>('idle');
  private readonly errorState = signal<string | null>(null);
  readonly profile = this.profileState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly errorMessage = this.errorState.asReadonly();
  readonly initials = computed(() => initialsFromUsername(this.profileState()?.username ?? ''));

  load(): void {
    if (this.statusState() === 'loading' || this.statusState() === 'loaded') return;
    this.statusState.set('loading');
    this.service.getMine().pipe(tap((profile) => { this.profileState.set(profile); this.statusState.set('loaded'); this.errorState.set(null); }), catchError(() => { this.statusState.set('error'); this.errorState.set('Unable to load your profile. Please try again.'); return EMPTY; })).subscribe();
  }

  updateCurrency(currency: CurrencyCode) {
    this.statusState.set('saving');
    return this.service.updatePreferences({ currency }).pipe(tap({ next: ({ preferences }) => { const profile = this.profileState(); if (profile) this.profileState.set({ ...profile, preferences }); this.statusState.set('loaded'); this.errorState.set(null); this.budgetStore.clear(); this.budgetStore.load(); }, error: () => { this.statusState.set('error'); this.errorState.set("We couldn't save your preferences. Please try again."); } }));
  }

  clear(): void { this.profileState.set(null); this.statusState.set('idle'); this.errorState.set(null); }
}
