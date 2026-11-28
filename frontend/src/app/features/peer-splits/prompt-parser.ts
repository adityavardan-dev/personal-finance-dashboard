import type { SplitInput, SplitParticipant } from './peer-splits.service';

export interface PromptDraft {
  input: SplitInput;
  note: string;
}

const STOP = new Set(['i', 'me', 'my', 'self', 'we', 'us']);
const MONEY = '(?:₹|rs\\.?|inr|\\$|usd|€|eur)?\\s*([\\d,]+(?:\\.\\d{1,2})?)';

export function toMinor(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [major, fraction = ''] = value.trim().split('.');
  const amount = Number(major) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : null;
}

export function parseSplitPrompt(text: string): PromptDraft | null {
  const clean = text.trim().replace(/\s+/g, ' ');
  const paid = clean.match(new RegExp(String.raw`\b(?:i|self)\s+paid\s+${MONEY}`, 'i'));
  const alternativePaid = clean.match(new RegExp(String.raw`\bpaid\s+${MONEY}`, 'i'));
  const total = toMinor((paid ?? alternativePaid)?.[1]?.replace(/,/g, '') ?? '');
  if (!total || total <= 0) return null;
  const currency = /\$|\busd\b/i.test(clean) ? 'USD' : /€|\beur\b/i.test(clean) ? 'EUR' : 'INR';
  const participants: SplitParticipant[] = [{ id: 'self', displayName: 'You' }];
  const fixed = new Map<string, number>();
  const add = (name: string): string => {
    const normalized = name
      .trim()
      .replace(/[^a-zA-Z '-]/g, '')
      .trim();
    if (STOP.has(normalized.toLowerCase())) return 'self';
    const id = normalized.toLowerCase().replace(/\s+/g, '-');
    if (id && !participants.some((item) => item.id === id))
      participants.push({ id, displayName: normalized });
    return id;
  };
  const fixedPattern = new RegExp(
    String.raw`\b([A-Za-z][A-Za-z '-]{0,40}?)\s+(?:owes|pays|share is|had)\s+${MONEY}`,
    'gi',
  );
  for (const match of clean.matchAll(fixedPattern)) {
    const name =
      match[1]
        .split(/\b(?:but|and|then)\b/i)
        .at(-1)
        ?.trim() ?? match[1];
    const amount = toMinor(match[2].replace(/,/g, ''));
    if (amount !== null) fixed.set(add(name), amount);
  }
  const group = clean.match(
    /\b(?:between|among|with|split between|split among)\s+(.+?)(?:\s+split\b|\s+equally\b|\s+the remainder\b|\s+the rest\b|[.;]|$)/i,
  );
  if (group) {
    for (const name of group[1].split(/\s*,\s*|\s+and\s+/i)) add(name);
  }
  const remainder = clean.match(
    /\b([A-Za-z][A-Za-z '-]{0,30}?)\s+and\s+([A-Za-z][A-Za-z '-]{0,30}?)\s+split\s+(?:the\s+)?(?:remainder|rest)/i,
  );
  if (remainder) {
    add(remainder[1]);
    add(remainder[2]);
  }
  if (participants.length < 2) return null;
  const allocationRules: SplitInput['allocationRules'] = [...fixed].map(
    ([participantId, amountMinor]) => ({ kind: 'FIXED_AMOUNT', participantId, amountMinor }),
  );
  allocationRules.push({
    kind: 'EQUAL_REMAINDER',
    participantIds: participants.map((item) => item.id).filter((id) => !fixed.has(id)),
  });
  return {
    note: clean,
    input: {
      totalAmountMinor: total,
      currency,
      participants,
      contributions: [{ participantId: 'self', amountMinor: total }],
      allocationRules,
    },
  };
}
