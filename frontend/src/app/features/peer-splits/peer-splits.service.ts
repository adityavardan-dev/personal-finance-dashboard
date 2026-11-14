import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { API_CONFIG } from '../../core/config/api.config';
import { AuthService } from '../auth/auth';
import { isValidSplitDate } from './split-date';

export type SplitCurrency = 'INR' | 'USD' | 'EUR';
export interface SplitParticipant {
  id: string;
  displayName: string;
}
export type SplitRule =
  | { kind: 'FIXED_AMOUNT'; participantId: string; amountMinor: number }
  | { kind: 'PERCENTAGE'; participantId: string; basisPoints: number }
  | { kind: 'WEIGHT'; participantId: string; weight: number }
  | { kind: 'EQUAL_REMAINDER'; participantIds: string[] };
export interface SplitInput {
  totalAmountMinor: number;
  currency: SplitCurrency;
  participants: SplitParticipant[];
  contributions: { participantId: string; amountMinor: number }[];
  allocationRules: SplitRule[];
}
export interface SplitResult {
  totalAmountMinor: number;
  currency: SplitCurrency;
  allocations: { participantId: string; amountOwedMinor: number; sourceRule: SplitRule['kind'] }[];
  balances: {
    participantId: string;
    amountPaidMinor: number;
    amountOwedMinor: number;
    netBalanceMinor: number;
  }[];
  obligations: { fromParticipantId: string; toParticipantId: string; amountMinor: number }[];
}

export interface SplitGroup {
  id: string;
  title: string;
  date?: string | null;
  category?: string | null;
  merchant?: string | null;
  participants: SplitParticipant[];
  result: SplitResult;
  example: boolean;
}

const examples: SplitGroup[] = [
  {
    id: 'example-bowling',
    title: 'Bowling night',
    example: true,
    participants: [
      { id: 'self', displayName: 'You' },
      { id: 'jaswanth', displayName: 'Jaswanth' },
      { id: 'harsha', displayName: 'Harsha' },
    ],
    result: {
      currency: 'INR',
      totalAmountMinor: 180000,
      allocations: [
        { participantId: 'self', amountOwedMinor: 70000, sourceRule: 'EQUAL_REMAINDER' },
        { participantId: 'jaswanth', amountOwedMinor: 40000, sourceRule: 'FIXED_AMOUNT' },
        { participantId: 'harsha', amountOwedMinor: 70000, sourceRule: 'EQUAL_REMAINDER' },
      ],
      balances: [
        {
          participantId: 'self',
          amountPaidMinor: 180000,
          amountOwedMinor: 70000,
          netBalanceMinor: 110000,
        },
        {
          participantId: 'jaswanth',
          amountPaidMinor: 0,
          amountOwedMinor: 40000,
          netBalanceMinor: -40000,
        },
        {
          participantId: 'harsha',
          amountPaidMinor: 0,
          amountOwedMinor: 70000,
          netBalanceMinor: -70000,
        },
      ],
      obligations: [
        { fromParticipantId: 'jaswanth', toParticipantId: 'self', amountMinor: 40000 },
        { fromParticipantId: 'harsha', toParticipantId: 'self', amountMinor: 70000 },
      ],
    },
  },
  {
    id: 'example-dinner',
    title: 'Dinner together',
    example: true,
    participants: [
      { id: 'self', displayName: 'You' },
      { id: 'harsha', displayName: 'Harsha' },
      { id: 'neha', displayName: 'Neha' },
    ],
    result: {
      currency: 'INR',
      totalAmountMinor: 90000,
      allocations: ['self', 'harsha', 'neha'].map((participantId) => ({
        participantId,
        amountOwedMinor: 30000,
        sourceRule: 'EQUAL_REMAINDER' as const,
      })),
      balances: [
        {
          participantId: 'self',
          amountPaidMinor: 0,
          amountOwedMinor: 30000,
          netBalanceMinor: -30000,
        },
        {
          participantId: 'harsha',
          amountPaidMinor: 90000,
          amountOwedMinor: 30000,
          netBalanceMinor: 60000,
        },
        {
          participantId: 'neha',
          amountPaidMinor: 0,
          amountOwedMinor: 30000,
          netBalanceMinor: -30000,
        },
      ],
      obligations: [
        { fromParticipantId: 'self', toParticipantId: 'harsha', amountMinor: 30000 },
        { fromParticipantId: 'neha', toParticipantId: 'harsha', amountMinor: 30000 },
      ],
    },
  },
  {
    id: 'example-trip',
    title: 'Weekend trip',
    example: true,
    participants: [
      { id: 'self', displayName: 'You' },
      { id: 'rahul', displayName: 'Rahul' },
      { id: 'priya', displayName: 'Priya' },
      { id: 'arjun', displayName: 'Arjun' },
    ],
    result: {
      currency: 'INR',
      totalAmountMinor: 240000,
      allocations: ['self', 'rahul', 'priya', 'arjun'].map((participantId) => ({
        participantId,
        amountOwedMinor: 60000,
        sourceRule: 'EQUAL_REMAINDER' as const,
      })),
      balances: [
        {
          participantId: 'self',
          amountPaidMinor: 120000,
          amountOwedMinor: 60000,
          netBalanceMinor: 60000,
        },
        {
          participantId: 'rahul',
          amountPaidMinor: 120000,
          amountOwedMinor: 60000,
          netBalanceMinor: 60000,
        },
        {
          participantId: 'priya',
          amountPaidMinor: 0,
          amountOwedMinor: 60000,
          netBalanceMinor: -60000,
        },
        {
          participantId: 'arjun',
          amountPaidMinor: 0,
          amountOwedMinor: 60000,
          netBalanceMinor: -60000,
        },
      ],
      obligations: [
        { fromParticipantId: 'priya', toParticipantId: 'self', amountMinor: 60000 },
        { fromParticipantId: 'arjun', toParticipantId: 'rahul', amountMinor: 60000 },
      ],
    },
  },
];

@Injectable({ providedIn: 'root' })
export class PeerSplitsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly groups = signal<SplitGroup[]>([...this.loadPreviews(), ...this.loadExamples()]);
  private lastSessionVersion = this.auth.sessionVersion();

  constructor() {
    effect(() => {
      const version = this.auth.sessionVersion();
      if (version === this.lastSessionVersion) return;
      this.lastSessionVersion = version;
      this.groups.set([...this.loadPreviews(), ...this.loadExamples()]);
    });
  }

  addPreview(
    title: string,
    participants: SplitParticipant[],
    result: SplitResult,
    details?: { date?: string | null; category?: string | null; merchant?: string | null },
  ): string {
    const id = crypto.randomUUID();
    this.groups.update((groups) => [
      { id, title, participants, result, example: false, ...details },
      ...groups,
    ]);
    this.storePreviews();
    return id;
  }

  getGroup(id: string): SplitGroup | undefined {
    return this.groups().find((group) => group.id === id);
  }

  updateDate(id: string, date: string): boolean {
    const group = this.getGroup(id);
    if (!group || !isValidSplitDate(date)) return false;
    this.groups.update((groups) =>
      groups.map((item) => (item.id === id ? { ...item, date } : item)),
    );
    this.storePreviews();
    return true;
  }

  private storageKey(): string {
    const token = this.auth.getAccessToken();
    if (!token) return 'xpense:split:anonymous';
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))) as {
        sub?: string | number;
      };
      return `xpense:split:${decoded.sub ?? 'unknown'}`;
    } catch {
      return 'xpense:split:unknown';
    }
  }

  private loadPreviews(): SplitGroup[] {
    if (!this.isBrowser) return [];
    try {
      const cached = JSON.parse(sessionStorage.getItem(this.storageKey()) ?? 'null') as {
        expiresAt: number;
        groups: SplitGroup[];
      } | null;
      if (!cached || cached.expiresAt < Date.now() || !Array.isArray(cached.groups)) return [];
      return cached.groups.filter(
        (group) => !group.example && group.id && group.result && Array.isArray(group.participants),
      );
    } catch {
      return [];
    }
  }

  private loadExamples(): SplitGroup[] {
    if (!this.isBrowser) return examples.map((group) => ({ ...group }));
    try {
      const cached = JSON.parse(sessionStorage.getItem(this.storageKey()) ?? 'null') as {
        expiresAt: number;
        exampleDates?: Record<string, string>;
      } | null;
      if (!cached || cached.expiresAt < Date.now()) return examples.map((group) => ({ ...group }));
      return examples.map((group) => {
        const date = cached.exampleDates?.[group.id];
        return { ...group, date: date && isValidSplitDate(date) ? date : group.date };
      });
    } catch {
      return examples.map((group) => ({ ...group }));
    }
  }

  private storePreviews(): void {
    if (!this.isBrowser) return;
    sessionStorage.setItem(
      this.storageKey(),
      JSON.stringify({
        expiresAt: Date.now() + 30 * 60 * 1000,
        groups: this.groups().filter((group) => !group.example),
        exampleDates: Object.fromEntries(
          this.groups()
            .filter((group) => group.example && group.date)
            .map((group) => [group.id, group.date]),
        ),
      }),
    );
  }
  preview(input: SplitInput) {
    return this.http.post<SplitResult>(`${API_CONFIG.baseUrl}/peer-splits/preview`, input);
  }
}
