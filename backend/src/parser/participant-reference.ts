/** Normalizes first-person participant aliases to the logged-in user label used by split drafts. */
const SELF_PARTICIPANT = /^(?:i|me|myself|self|you)$/i;
const SELF_REFERENCE_IN_TEXT = /\b(?:i|me|my|myself|self|you|your)\b/i;

export function normalizeParticipantName(name: string): string {
  const trimmed = name.trim();
  return SELF_PARTICIPANT.test(trimmed) ? 'You' : trimmed;
}

export function participantAppearsInText(name: string, text: string): boolean {
  const normalized = normalizeParticipantName(name);
  if (normalized === 'You') return SELF_REFERENCE_IN_TEXT.test(text);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, 'iu').test(text);
}
