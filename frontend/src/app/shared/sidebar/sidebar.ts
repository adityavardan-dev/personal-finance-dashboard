import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavigationItem {
  icon: 'home' | 'chart' | 'plus' | 'history' | 'user' | 'split';
  label: string;
  route: string;
  description: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  navigationItems: NavigationItem[] = [
    { icon: 'home', label: 'Dashboard', route: '/dashboard', description: 'Overview of your finances' },
    { icon: 'split', label: 'Peer Splits', route: '/peer-splits', description: 'Calculate shared bills' },
    { icon: 'chart', label: 'Insights', route: '/insights', description: 'Spending trends and insights' },
    { icon: 'plus', label: 'Add Expense', route: '/expenses/new', description: 'Record a new expense' },
    { icon: 'history', label: 'History', route: '/history', description: 'Review your transactions' },
    { icon: 'user', label: 'Profile', route: '/profile', description: 'Manage your profile' },
  ];
}
