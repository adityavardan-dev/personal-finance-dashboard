import { computed, Injectable, signal } from '@angular/core';

/** Tracks active browser API requests, including overlapping calls. */
@Injectable({ providedIn: 'root' })
export class ApiLoadingStore {
  private readonly activeRequests = signal(0);
  readonly loading = computed(() => this.activeRequests() > 0);

  start(): void { this.activeRequests.update((count) => count + 1); }
  finish(): void { this.activeRequests.update((count) => Math.max(0, count - 1)); }
}
