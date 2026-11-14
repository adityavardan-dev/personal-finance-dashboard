import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PeerSplitOverviewComponent } from './peer-split-overview';
import { PeerSplitsService, SplitGroup } from './peer-splits.service';

describe('PeerSplitOverviewComponent', () => {
  it('searches groups and previews actions without changing balances', async () => {
    const group: SplitGroup = {
      id: 'group-1',
      title: 'Bowling night',
      example: true,
      participants: [{ id: 'self', displayName: 'You' }, { id: 'friend', displayName: 'Harsha' }],
      result: {
        totalAmountMinor: 180000,
        currency: 'INR',
        allocations: [],
        balances: [{ participantId: 'self', amountPaidMinor: 180000, amountOwedMinor: 90000, netBalanceMinor: 90000 }],
        obligations: [],
      },
    };
    const groups = signal([group]);
    await TestBed.configureTestingModule({
      imports: [PeerSplitOverviewComponent],
      providers: [provideRouter([]), { provide: PeerSplitsService, useValue: { groups } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(PeerSplitOverviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.kpi-dot')).toHaveLength(2);
    const search = fixture.nativeElement.querySelector('input[aria-label="Search split groups"]') as HTMLInputElement;
    search.value = 'Harsha';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component['visibleGroups']()).toHaveLength(1);

    (fixture.nativeElement.querySelector('button[aria-label="Preview request settlement animation"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component['actionNotice']()).toContain('No balances changed');
    expect(group.result.balances[0].netBalanceMinor).toBe(90000);
  });
});
