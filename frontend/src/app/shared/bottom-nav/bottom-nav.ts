import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

let pressTimer: ReturnType<typeof setTimeout> | null = null;

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  private readonly document = inject(DOCUMENT);

  protected pressNav(): void {
    this.document.body.classList.add('nav-glass-press');
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      this.document.body.classList.remove('nav-glass-press');
      pressTimer = null;
    }, 1000);
  }
}
