import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './features/auth/auth';
import { BottomNav } from './shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNav],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly showBottomNav = computed(() => {
    const url = this.currentUrl();
    if (!this.authService.getAccessToken()) return false;
    if (url.startsWith('/peer-splits/new')) return false;
    if (url.startsWith('/expenses/new') && new URLSearchParams(url.split('?')[1] ?? '').get('mode') === 'split') return false;
    return ['/dashboard', '/insights', '/peer-splits', '/expenses', '/history', '/profile']
      .some((path) => url.startsWith(path));
  });
}
