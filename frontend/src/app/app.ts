import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './features/auth/auth';
import { BottomNav } from './shared/bottom-nav/bottom-nav';
import { PageSkeleton, PageSkeletonKind } from './shared/page-skeleton/page-skeleton';
import { ApiLoadingStore } from './core/loading/api-loading.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNav, PageSkeleton],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  protected readonly apiLoading = inject(ApiLoadingStore);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly skeletonKind = computed<PageSkeletonKind>(() => {
    const path = this.currentUrl().split('?')[0];
    if (['/login', '/signup', '/forgot-password', '/'].includes(path)) return 'auth';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/insights') return 'insights';
    if (path === '/history') return 'history';
    if (path.startsWith('/history/')) return 'detail';
    if (path === '/profile') return 'profile';
    if (path === '/peer-splits') return 'splits';
    if (path === '/peer-splits/new') return 'editor';
    if (path.startsWith('/peer-splits/')) return 'detail';
    if (path === '/expenses/intake') return 'intake';
    if (path.startsWith('/expenses/')) return 'editor';
    return 'dashboard';
  });

  protected readonly showBottomNav = computed(() => {
    const url = this.currentUrl();
    if (!this.authService.getAccessToken()) return false;
    if (url.startsWith('/peer-splits/new')) return false;
    if (url.startsWith('/expenses/new') && new URLSearchParams(url.split('?')[1] ?? '').get('mode') === 'split') return false;
    return ['/dashboard', '/insights', '/peer-splits', '/expenses', '/history', '/profile']
      .some((path) => url.startsWith(path));
  });
}
