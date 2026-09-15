import { Component } from '@angular/core';
import { HeroCard } from './components/hero-card/hero-card';
import { RecentActivity } from './components/recent-activity/recent-activity';
import { SpendingTrend } from './components/spending-trend/spending-trend';
import { InsightBanner } from './components/insight-banner/insight-banner';
import { AppLayout } from '../../shared/app-layout/app-layout';

@Component({
  selector: 'app-dashboard',
  imports: [HeroCard, AppLayout, SpendingTrend, RecentActivity, InsightBanner],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {}