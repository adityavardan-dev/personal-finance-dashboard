export function localDate(dayOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidSplitDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseSplitDateFollowUp(text: string): string | null {
  const normalized = text.trim().toLowerCase().replace(/[.!?]+$/, '').trim();
  const match = normalized.match(/\b(today|yesterday|\d{4}-\d{2}-\d{2})\b/);
  if (!match) return null;
  const remainder = normalized
    .replace(match[0], ' ')
    .replace(/\b(?:the|date|is|for|this|split|please|use|set|change|make|to|as|it|on)\b/g, ' ')
    .trim();
  if (remainder) return null;
  if (match[1] === 'today') return localDate();
  if (match[1] === 'yesterday') return localDate(-1);
  return isValidSplitDate(match[1]) ? match[1] : null;
}
