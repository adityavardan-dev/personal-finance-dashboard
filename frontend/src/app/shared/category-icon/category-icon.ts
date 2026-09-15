import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-category-icon',
  template: `
    <span class="flex h-full w-full items-center justify-center" aria-hidden="true">
      @switch (category) {
        @case ('Coffee') {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z"/><path d="M16 10h1a3 3 0 0 1 0 6h-1"/><path d="M8 4c0 1 1 1 1 2M12 4c0 1 1 1 1 2"/></svg>
        }
        @case ('Shopping') {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
        }
        @case ('Food & Dining') {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3v18M14 3v7c0 2 3 2 3 0"/></svg>
        }
        @case ('Transport') {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14l-1-8c-.2-1.2-1.1-2-2.3-2H8.3C7.1 7 6.2 7.8 6 9l-1 8Z"/><path d="M7 17v2M17 17v2M7 11h10"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>
        }
        @case ('Utilities') {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-8 11h6l-1 9 8-12h-6l1-8Z"/></svg>
        }
        @case ('Entertainment') {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/></svg>
        }
        @case ('Delivery') {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>
        }
        @case ('Income') {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M17 7.5C17 5.8 15.3 5 12.8 5S9 6 9 7.8c0 2 1.6 2.6 4 3.3 2.4.7 4 1.4 4 3.4 0 1.9-1.8 3.5-4.8 3.5S7 16.8 7 14.5"/></svg>
        }
        @default {
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M9 12h6M12 9v6"/></svg>
        }
      }
    </span>
  `,
})
export class CategoryIcon {
  @Input({ required: true }) category = '';
}
