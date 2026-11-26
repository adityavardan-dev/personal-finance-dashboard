/** Asks Cloudflare for split amounts and group sizes when local rules are unclear. */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { recordXpenseCloudflareTelemetry } from '../expense-semantics/xpense-cloudflare-telemetry';
import type { RequestTrace } from '../request-trace';
import { CloudflareStructuredModelProvider } from '../semantic-sdk';
import type {
  PendingSplitContext,
  SplitFollowUpProposal,
} from './split-follow-up.service';
import {
  PENNY_MAX_COMPLETION_TOKENS,
  PENNY_TEMPERATURE,
} from './cloudflare-usage';
import { AiMetricsService } from './ai-metrics.service';
import { loadPennyGuidance } from './penny-guidance';

export interface ProposedSplit {
  amount: string;
  peopleCount: string;
  participants?: string[];
  paidBy?: string | null;
  allocationKind?: 'EQUAL' | 'FULL_TO_OTHER';
  beneficiary?: string | null;
}
@Injectable()
export class CloudflareSplitInterpreter {
  private readonly logger = new Logger(CloudflareSplitInterpreter.name);

  constructor(
    @Optional() private readonly metrics?: AiMetricsService,
    @Optional()
    private readonly structuredProvider?: CloudflareStructuredModelProvider,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      (
        this.structuredProvider ?? new CloudflareStructuredModelProvider()
      ).isConfigured() && loadPennyGuidance(),
    );
  }

  /** Returns structured split proposals from a message, including implied group size. */
  async interpret(
    text: string,
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<ProposedSplit[] | null> {
    const guidance = loadPennyGuidance();
    if (!guidance) return null;
    const queryJson = { message: text };
    const result = await this.provider().generateStructured<unknown>(
      {
        temperature: PENNY_TEMPERATURE,
        maxCompletionTokens: PENNY_MAX_COMPLETION_TOKENS,
        responseSchema: {
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
                required: [
                  'amount',
                  'peopleCount',
                  'participants',
                  'paidBy',
                  'allocationKind',
                  'beneficiary',
                ],
                properties: {
                  amount: { type: 'string' },
                  peopleCount: { type: 'string' },
                  participants: {
                    type: 'array',
                    maxItems: 100,
                    items: { type: 'string' },
                  },
                  paidBy: { type: ['string', 'null'] },
                  allocationKind: {
                    type: 'string',
                    enum: ['EQUAL', 'FULL_TO_OTHER'],
                  },
                  beneficiary: { type: ['string', 'null'] },
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
      },
      (event) =>
        recordXpenseCloudflareTelemetry(
          this.logger,
          this.metrics,
          accessToken,
          { trace, route: 'split-intent', queryJson },
          event,
        ),
    );
    if (result.status !== 'SUCCESS') return null;
    const parsed = result.value;
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
          (item.participants === undefined ||
            (Array.isArray(item.participants) &&
              item.participants.every(
                (name: unknown) => typeof name === 'string',
              ))) &&
          (item.paidBy === undefined ||
            item.paidBy === null ||
            typeof item.paidBy === 'string') &&
          (item.allocationKind === undefined ||
            item.allocationKind === 'EQUAL' ||
            item.allocationKind === 'FULL_TO_OTHER') &&
          (item.beneficiary === undefined ||
            item.beneficiary === null ||
            typeof item.beneficiary === 'string'),
      )
    )
      return null;
    return parsed.drafts as ProposedSplit[];
  }

  /** Proposes participant edits for numbered pending splits. */
  async interpretFollowUp(
    text: string,
    pending: PendingSplitContext[],
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<SplitFollowUpProposal[] | null> {
    const guidance = loadPennyGuidance();
    if (!guidance) return null;
    const queryJson = { message: text, pendingSplits: pending };
    const result = await this.provider().generateStructured<unknown>(
      {
        temperature: PENNY_TEMPERATURE,
        maxCompletionTokens: PENNY_MAX_COMPLETION_TOKENS,
        responseSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['updates'],
          properties: {
            updates: {
              type: 'array',
              minItems: 1,
              maxItems: 20,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'ordinal',
                  'names',
                  'paidBy',
                  'amount',
                  'peopleCount',
                ],
                properties: {
                  ordinal: { type: 'integer' },
                  names: {
                    type: ['array', 'null'],
                    maxItems: 100,
                    items: { type: 'string' },
                  },
                  paidBy: { type: ['string', 'null'] },
                  amount: { type: ['string', 'null'] },
                  peopleCount: { type: ['integer', 'null'] },
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
              'Map the current follow-up to edits of the pending numbered split drafts. Return only fields the user wants changed; use null for all others. names is the complete revised list when participants change, including existing names from pending context. For a payer-only, total-only, or people-count-only edit, names is null. A payer may be named before participants; preserve that partial fact for a later turn. New names, payer, amount, and count must be supported by the current message. Never invent people, payment, or allocation details. Do not change currency or date. If a target is ambiguous, return no update. Output JSON matching the schema.',
          },
          {
            role: 'user',
            content: JSON.stringify({ message: text, pendingSplits: pending }),
          },
        ],
      },
      (event) =>
        recordXpenseCloudflareTelemetry(
          this.logger,
          this.metrics,
          accessToken,
          { trace, route: 'split-follow-up', queryJson },
          event,
        ),
    );
    if (result.status !== 'SUCCESS') return null;
    const parsed = result.value;
    if (!isRecord(parsed) || !Array.isArray(parsed.updates)) return null;
    if (
      !parsed.updates.every(
        (item: unknown) =>
          isRecord(item) &&
          Number.isInteger(item.ordinal) &&
          (item.names === null ||
            (Array.isArray(item.names) &&
              item.names.every((name: unknown) => typeof name === 'string'))) &&
          (item.paidBy === null || typeof item.paidBy === 'string') &&
          (item.amount === null || typeof item.amount === 'string') &&
          (item.peopleCount === null || Number.isInteger(item.peopleCount)),
      )
    )
      return null;
    return parsed.updates as SplitFollowUpProposal[];
  }

  private provider(): CloudflareStructuredModelProvider {
    return this.structuredProvider ?? new CloudflareStructuredModelProvider();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
