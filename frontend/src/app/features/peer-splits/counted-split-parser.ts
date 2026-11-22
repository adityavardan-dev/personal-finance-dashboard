export interface PendingSplit {
  id: string;
  ordinal: number;
  amountMinor: number;
  peopleCount: number;
  currency: 'INR' | 'USD' | 'EUR';
  date: string | null;
  names: string;
  paidBy: string;
  allocationKind?: 'EQUAL' | 'FULL_TO_OTHER';
  beneficiary?: string;
}
