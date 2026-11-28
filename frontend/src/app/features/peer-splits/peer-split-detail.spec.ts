import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PeerSplitDetailComponent } from './peer-split-detail';
import { PeerSplitsService, SplitGroup } from './peer-splits.service';

describe('PeerSplitDetailComponent', () => {
  let fixture: ComponentFixture<PeerSplitDetailComponent>;

  it.each([false, true])('lets the user change the date when example is %s', async (example) => {
    const group = signal<SplitGroup>({
      id: 'split-1',
      title: 'Group split',
      date: null,
      example,
      participants: [{ id: 'self', displayName: 'You' }],
      result: {
        totalAmountMinor: 300000,
        currency: 'INR',
        allocations: [],
        balances: [],
        obligations: [],
      },
    });
    const service = {
      getGroup: vi.fn(() => group()),
      updateDate: vi.fn((_id: string, date: string) => {
        group.update((current) => ({ ...current, date }));
        return true;
      }),
    };
    await TestBed.configureTestingModule({
      imports: [PeerSplitDetailComponent],
      providers: [
        provideRouter([]),
        { provide: PeerSplitsService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'split-1' }) } },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(PeerSplitDetailComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#split-date') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = '2026-11-13';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(service.updateDate).toHaveBeenCalledWith('split-1', '2026-11-13');
    expect(fixture.nativeElement.textContent).toContain('2026-11-13');
  });
});
