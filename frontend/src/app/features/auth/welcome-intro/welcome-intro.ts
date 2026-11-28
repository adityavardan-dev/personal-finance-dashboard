import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, Component, DestroyRef, HostListener, inject, output, PLATFORM_ID, signal } from '@angular/core';

const SEEN_KEY = 'xpense:auth-welcome-seen';
const DURATION_MS = 2880;
const PROGRESS_MS = 2340;
const REVEAL_MS = 480;

@Component({
  selector: 'app-welcome-intro',
  templateUrl: './welcome-intro.html',
  styleUrl: './welcome-intro.css',
})
export class WelcomeIntroComponent {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private frame = 0;
  private started = 0;
  private revealTimer: ReturnType<typeof setTimeout> | undefined;

  readonly finished = output<void>();
  readonly active = signal(false);
  readonly revealing = signal(false);
  readonly progress = signal(0);

  constructor() {
    this.destroyRef.onDestroy(() => this.cancel());
    afterNextRender(() => this.start());
  }

  @HostListener('document:focusin')
  onInteraction(): void {
    this.dismiss();
  }

  @HostListener('document:pointerdown')
  onPointerDown(): void {
    this.onInteraction();
  }

  private start(): void {
    if (!this.browser) return;

    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // Storage may be disabled; the form still remains usable.
    }
    if (seen || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.remember();
      return;
    }

    this.active.set(true);
    this.remember();
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  dismiss(): void {
    if (!this.active()) return;
    this.cancel();
    this.active.set(false);
    this.finished.emit();
  }

  private tick(time: number): void {
    if (!this.active()) return;
    if (!this.started) this.started = time;
    const elapsed = time - this.started;
    this.progress.set(Math.min(100, Math.floor((elapsed / PROGRESS_MS) * 100)));
    if (elapsed < DURATION_MS) {
      this.frame = requestAnimationFrame((next) => this.tick(next));
      return;
    }
    this.progress.set(100);
    this.revealing.set(true);
    this.revealTimer = setTimeout(() => this.dismiss(), REVEAL_MS);
  }

  private remember(): void {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // A blocked storage API must never block authentication.
    }
  }

  private cancel(): void {
    if (this.browser) cancelAnimationFrame(this.frame);
    if (this.revealTimer) clearTimeout(this.revealTimer);
  }
}
