import { Component, input } from '@angular/core';
import { Sidebar } from '../sidebar/sidebar';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { Header } from '../header/header';

@Component({
  selector: 'app-app-layout',
  imports: [Sidebar, BottomNav, Header],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayout {
  readonly variant = input<'default' | 'glass'>('glass');
  readonly hideHeader = input(false);
  readonly hideBottomNav = input(false);
}
