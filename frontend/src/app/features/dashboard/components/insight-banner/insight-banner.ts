import { Component } from '@angular/core';

@Component({
  selector: 'app-insight-banner',
  standalone: true,
  imports: [],
  templateUrl: './insight-banner.html',
})
export class InsightBanner {
  readonly title = 'Your spending is trending higher';
  readonly message = 'Dining and shopping are your biggest flexible categories this month.';
}