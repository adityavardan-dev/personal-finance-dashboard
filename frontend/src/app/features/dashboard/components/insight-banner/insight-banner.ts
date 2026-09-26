import { Component, Input } from '@angular/core';
import { DeterministicInsight } from '../../../../core/finance/finance-models';

@Component({
  selector: 'app-insight-banner',
  standalone: true,
  imports: [],
  templateUrl: './insight-banner.html',
})
export class InsightBanner {
  @Input() insight: DeterministicInsight | null = null;

  get title() { return this.insight?.title ?? 'Start tracking your spending'; }
  get message() { return this.insight?.message ?? 'Add your first expense to unlock financial insights.'; }
  get severity() { return this.insight?.severity ?? 'info'; }
}
