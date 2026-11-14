import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';

let pressTimer: ReturnType<typeof setTimeout> | null = null;

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activeIndex = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/dashboard')) return 0;
    if (url.startsWith('/insights')) return 1;
    if (url.startsWith('/expenses')) return 2;
    if (url.startsWith('/history')) return 3;
    if (url.startsWith('/profile')) return 4;
    return -1;
  });

  protected pressNav(): void {
    this.document.body.classList.add('nav-glass-press');
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      this.document.body.classList.remove('nav-glass-press');
      pressTimer = null;
    }, 1000);
  }
}
