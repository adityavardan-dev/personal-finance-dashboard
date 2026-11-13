import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { PeerSplitsService, SplitGroup } from './peer-splits.service';

@Component({
  selector: 'app-peer-split-overview',
  imports: [AppLayout, FormsModule, RouterLink],
  templateUrl: './peer-split-overview.html',
  styleUrl: './peer-split-overview.css',
})
export class PeerSplitOverviewComponent {
  private readonly service = inject(PeerSplitsService);
  protected readonly groups = this.service.groups;
  protected readonly search = signal('');
  protected readonly openId = signal<string | null>(null);
  protected readonly visibleGroups = computed(() =>
    this.groups().filter(
      (group) =>
        group.title.toLowerCase().includes(this.search().trim().toLowerCase()) ||
        group.participants.some((person) =>
          person.displayName.toLowerCase().includes(this.search().trim().toLowerCase()),
        ),
    ),
  );
  protected readonly totals = computed(() =>
    this.groups().reduce(
      (total, group) => {
        if (group.result.currency !== 'INR') return total;
        const net =
          group.result.balances.find((balance) => balance.participantId === 'self')
            ?.netBalanceMinor ?? 0;
        total.owe += Math.max(-net, 0);
        total.back += Math.max(net, 0);
        return total;
      },
      { owe: 0, back: 0 },
    ),
  );

  protected toggle(id: string): void {
    this.openId.update((current) => (current === id ? null : id));
  }
  protected groupBalance(group: SplitGroup): { owe: number; back: number } {
    const net =
      group.result.balances.find((balance) => balance.participantId === 'self')?.netBalanceMinor ??
      0;
    return { owe: Math.max(-net, 0), back: Math.max(net, 0) };
  }
  protected money(amountMinor: number, currency: string): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(
      amountMinor / 100,
    );
  }
}
