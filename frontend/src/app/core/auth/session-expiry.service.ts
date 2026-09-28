import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, Injector, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { BudgetStore } from '../budget/budget.store';
import { FinanceMetricsStore } from '../finance/finance-metrics.store';
import { ProfileStore } from '../profile/profile.store';
import { AuthService } from '../../features/auth/auth';

export interface SessionExpiryContext {
  reason: 'expired-or-invalid';
  returnUrl: string;
}

export function safeInternalReturnUrl(value: string | null | undefined): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

@Injectable({ providedIn: 'root' })
export class SessionExpiryService {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private handling = false;

  handleUnauthorized(): void {
    if (!this.isBrowser || this.handling) return;

    this.handling = true;
    const returnUrl = safeInternalReturnUrl(this.router.url);
    this.injector.get(AuthService).clearSession();
    this.injector.get(ProfileStore).clear();
    this.injector.get(BudgetStore).clear();
    this.injector.get(FinanceMetricsStore).clear();

    void this.router.navigate(['/login'], {
      queryParams: { reason: 'session-expired', returnUrl },
    }).finally(() => queueMicrotask(() => this.handling = false));
  }
}
