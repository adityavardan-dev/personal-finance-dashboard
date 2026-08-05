import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HeroCard } from './components/hero-card/hero-card';
import { RecentActivity } from './components/recent-activity/recent-activity';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { SpendingTrend } from './components/spending-trend/spending-trend';
@Component({
  selector: 'app-dashboard',
  imports: [HeroCard, AppLayout, SpendingTrend, RecentActivity],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  private router = inject(Router);

  logout() {
    // This method is called when the user clicks the logout button.
    // It navigates the user back to the '/login' route using the Router service.
    this.router.navigate(['/login']);
  }
}
