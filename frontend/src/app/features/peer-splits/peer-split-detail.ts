import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { PeerSplitsService } from './peer-splits.service';

@Component({
  selector: 'app-peer-split-detail',
  imports: [AppLayout, RouterLink, FormsModule],
  templateUrl: './peer-split-detail.html',
  styleUrl: './peer-split-detail.css',
})
export class PeerSplitDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PeerSplitsService);
  protected readonly group = computed(() =>
    this.service.getGroup(this.route.snapshot.paramMap.get('id') ?? ''),
  );
  protected readonly search = signal('');
  protected readonly dateMessage = signal('');
  protected readonly participants = computed(
    () =>
      this.group()?.participants.filter((person) =>
        person.displayName.toLowerCase().includes(this.search().toLowerCase().trim()),
      ) ?? [],
  );
  protected name(id: string): string {
    return this.group()?.participants.find((person) => person.id === id)?.displayName ?? id;
  }
  protected balance(id: string): number {
    return (
      this.group()?.result.balances.find((item) => item.participantId === id)?.netBalanceMinor ?? 0
    );
  }
  protected share(id: string): number {
    return (
      this.group()?.result.allocations.find((item) => item.participantId === id)?.amountOwedMinor ??
      0
    );
  }
  protected money(amountMinor: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: this.group()?.result.currency ?? 'INR',
    }).format(amountMinor / 100);
  }
  protected setDate(date: string): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.dateMessage.set(
      this.service.updateDate(id, date) ? 'Date updated in this preview.' : 'Choose a valid date.',
    );
  }
}
