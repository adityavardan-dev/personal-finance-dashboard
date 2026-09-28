import { AfterViewInit, Component, ElementRef, inject } from '@angular/core';
import { Sidebar } from '../sidebar/sidebar';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { Header } from "../header/header";

@Component({
  selector: 'app-app-layout',
  imports: [Sidebar, BottomNav, Header],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayout implements AfterViewInit {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    queueMicrotask(() => this.element.nativeElement.querySelector<HTMLElement>('main')?.focus({ preventScroll: true }));
  }
}
