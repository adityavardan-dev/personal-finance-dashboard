import { Component } from '@angular/core';

interface NavigationItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [],
  templateUrl: './sidebar.html',
})
export class Sidebar {

  navigationItems: NavigationItem[] = [
    {
      icon: 'home',
      label: 'Dashboard',
      route: '/dashboard',
    },
    {
      icon: 'chart',
      label: 'Insights',
      route: '/insights',
    },
    {
      icon: 'plus',
      label: 'Add Expense',
      route: '/expenses/new',
    },
    {
      icon: 'history',
      label: 'History',
      route: '/history',
    },
    {
      icon: 'user',
      label: 'Profile',
      route: '/profile',
    },
  ];

}