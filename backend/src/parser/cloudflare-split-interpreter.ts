/** Asks Cloudflare for split amounts and group sizes when local rules are unclear. */
import { Injectable } from '@nestjs/common';
import type { PendingSplitContext, SplitFollowUpProposal } from './split-follow-up.service';
import { loadPennyGuidance } from './penny-guidance';

export interface ProposedSplit {
  amount: string;
  peopleCount: string;
  participants?: string[];
  paidBy?: string | null;
  allocationKind?: 'EQUAL' | 'FULL_TO_OTHER';
  beneficiary?: string | null;
}
const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';

@Injectable()
export class CloudflareSplitInterpreter {
  isConfigured(): boolean {
    return Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_AI_API_TOKEN?.trim() &&
      loadPennyGuidance(),
    );
  }

  /** Returns structured split proposals from a message, including implied group size. */
  async interpret(text: string): Promise<ProposedSplit[] | null> {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const token = process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
    const guidance = loadPennyGuidance();
    if (!account || !token || !guidance) return null;
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            model: process.env.CLOUDFLARE_AI_MODEL?.trim() || DEFAULT_MODEL,
            stream: false,
            temperature: 0,
            max_completion_tokens: 1024,
            chat_template_kwargs: { enable_thinking: false },
            response_format: {
              type: 'json_schema',
              json_schema: {
                type: 'object',
                additionalProperties: false,
                required: ['drafts'],
                properties: {
                  drafts: {
                    type: 'array',
                    minItems: 0,
                    maxItems: 20,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['amount', 'peopleCount', 'participants', 'paidBy', 'allocationKind', 'beneficiary'],
                      properties: {
                        amount: { type: 'string' },
                        peopleCount: { type: 'string' },
                        participants: { type: 'array', maxItems: 100, items: { type: 'string' } },
                        paidBy: { type: ['string', 'null'] },
                        allocationKind: { type: 'string', enum: ['EQUAL', 'FULL_TO_OTHER'] },
                        beneficiary: { type: ['string', 'null'] },
                      },
                    },
                  },
                },
              },
            },
            messages: [
              { role: 'system', content: guidance },
              {
                role: 'system',
                content:
                  'Extract each separate peer split expense in order. Copy each amount exactly from the message. Infer peopleCount from an explicit digit, number word, or identified participants; include You for I/me/my. Return participant names copied from the message, using You for the speaker. Identify who paid. EQUAL means everyone named shares the expense equally. FULL_TO_OTHER means the named beneficiary owes the payer the entire amount; set beneficiary to that person. For example, "Harsha paid 500 for me and him" is amount 500, peopleCount 2, participants You and Harsha, paidBy Harsha, EQUAL. "I paid 300 to Katty" in a peer-split context is amount 300, peopleCount 2, participants You and Katty, paidBy You, FULL_TO_OTHER, beneficiary Katty. If the split meaning is unclear, return no draft rather than inventing. For an unnamed group, participants is empty and the count must be explicit in the message. Output JSON matching the schema.',
              },
              { role: 'user', content: text },
            ],
          }),
        },
      );
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.choices)) return null;
      const first: unknown = body.choices[0];
      if (
        !isRecord(first) ||
        !isRecord(first.message) ||
        typeof first.message.content !== 'string'
      )
        return null;
      const parsed: unknown = JSON.parse(first.message.content);
      if (
        !isRecord(parsed) ||
        !Array.isArray(parsed.drafts) ||
        parsed.drafts.length > 20
      )
        return null;
      if (
        !parsed.drafts.every(
          (item: unknown) =>
            isRecord(item) &&
            typeof item.amount === 'string' &&
            typeof item.peopleCount === 'string' &&
            (item.participants === undefined || (Array.isArray(item.participants) && item.participants.every((name: unknown) => typeof name === 'string'))) &&
            (item.paidBy === undefined || item.paidBy === null || typeof item.paidBy === 'string') &&
            (item.allocationKind === undefined || item.allocationKind === 'EQUAL' || item.allocationKind === 'FULL_TO_OTHER') &&
            (item.beneficiary === undefined || item.beneficiary === null || typeof item.beneficiary === 'string'),
        )
      )
        return null;
      return parsed.drafts as ProposedSplit[];
    } catch {
      return null;
    }
  }

  /** Proposes participant edits for numbered pending splits. */
  async interpretFollowUp(text: string, pending: PendingSplitContext[]): Promise<SplitFollowUpProposal[] | null> {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const token = process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
    const guidance = loadPennyGuidance();
    if (!account || !token || !guidance) return null;
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/v1/chat/completions`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            model: process.env.CLOUDFLARE_AI_MODEL?.trim() || DEFAULT_MODEL,
            stream: false,
            temperature: 0,
            max_completion_tokens: 1024,
            chat_template_kwargs: { enable_thinking: false },
            response_format: {
              type: 'json_schema',
              json_schema: {
                type: 'object', additionalProperties: false, required: ['updates'],
                properties: { updates: {
                  type: 'array', minItems: 1, maxItems: 20,
                  items: {
                    type: 'object', additionalProperties: false, required: ['ordinal', 'names', 'paidBy', 'amount', 'peopleCount'],
                    properties: {
                      ordinal: { type: 'integer' },
                      names: { type: ['array', 'null'], maxItems: 100, items: { type: 'string' } },
                      paidBy: { type: ['string', 'null'] },
                      amount: { type: ['string', 'null'] },
                      peopleCount: { type: ['integer', 'null'] },
                    },
                  },
                } },
              },
            },
            messages: [
              { role: 'system', content: guidance },
              { role: 'system', content: 'Map the current follow-up to edits of the pending numbered split drafts. Return only fields the user wants changed; use null for all others. names is the complete revised list when participants change, including existing names from pending context. For a payer-only, total-only, or people-count-only edit, names is null. A payer may be named before participants; preserve that partial fact for a later turn. New names, payer, amount, and count must be supported by the current message. Never invent people, payment, or allocation details. Do not change currency or date. If a target is ambiguous, return no update. Output JSON matching the schema.' },
              { role: 'user', content: JSON.stringify({ message: text, pendingSplits: pending }) },
            ],
          }),
        },
      );
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.choices)) return null;
      const first: unknown = body.choices[0];
      if (!isRecord(first) || !isRecord(first.message) || typeof first.message.content !== 'string') return null;
      const parsed: unknown = JSON.parse(first.message.content);
      if (!isRecord(parsed) || !Array.isArray(parsed.updates)) return null;
      if (!parsed.updates.every((item: unknown) => isRecord(item) && Number.isInteger(item.ordinal) && (item.names === null || (Array.isArray(item.names) && item.names.every((name: unknown) => typeof name === 'string'))) && (item.paidBy === null || typeof item.paidBy === 'string') && (item.amount === null || typeof item.amount === 'string') && (item.peopleCount === null || Number.isInteger(item.peopleCount)))) return null;
      return parsed.updates as SplitFollowUpProposal[];
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
