import { Component } from '@angular/core';

@Component({
  selector: 'app-insight-banner',
  standalone: true,
  imports: [],
  templateUrl: './insight-banner.html',
})
export class InsightBanner {
  readonly title = 'Your spending is trending higher';
  readonly message = 'Shopping and dining are your biggest flexible categories this month. This intelligence surface is designed to become richer as XPENSE adds personalized AI analysis.';
}
