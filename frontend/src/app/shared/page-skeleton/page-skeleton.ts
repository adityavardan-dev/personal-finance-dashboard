import { Component, input } from '@angular/core';

export type PageSkeletonKind =
  | 'auth'
  | 'dashboard'
  | 'insights'
  | 'history'
  | 'detail'
  | 'profile'
  | 'splits'
  | 'editor'
  | 'intake';

/** Mirrors the active page while an HTTP request is pending; routing alone never shows it. */
@Component({
  selector: 'app-page-skeleton',
  templateUrl: './page-skeleton.html',
  styleUrl: './page-skeleton.css',
  host: { class: 'block min-h-screen' },
})
export class PageSkeleton {
  readonly label = input('Waiting for request');
  readonly kind = input<PageSkeletonKind>('dashboard');
}
