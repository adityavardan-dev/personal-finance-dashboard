/** Requests structured edits to existing personal expense drafts from PENNY. */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { recordXpenseCloudflareTelemetry } from '../expense-semantics/xpense-cloudflare-telemetry';
import type { RequestTrace } from '../request-trace';
import { CloudflareStructuredModelProvider } from '@adityavardan/provider-cloudflare';
import type {
  PersonalDraftContext,
  PersonalEditProposal,
} from '@adityavardan/xpense-semantics';
import {
  PENNY_MAX_COMPLETION_TOKENS,
  PENNY_TEMPERATURE,
} from './cloudflare-usage';
import { AiMetricsService } from './ai-metrics.service';
import { loadPennyGuidance } from './penny-guidance';

export type {
  PersonalDraftContext,
  PersonalEditProposal,
} from '@adityavardan/xpense-semantics';

const PERSONAL_EDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['updates'],
  properties: {
    updates: {
      type: 'array',
      minItems: 0,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'ordinal',
          'action',
          'amount',
          'date',
          'dateEvidence',
          'category',
          'merchant',
          'splitResolution',
          'splitFactor',
        ],
        properties: {
          ordinal: { type: 'integer' },
          action: { type: 'string', enum: ['UPDATE', 'DELETE'] },
          amount: { type: ['string', 'null'] },
          date: { type: ['string', 'null'] },
          dateEvidence: { type: ['string', 'null'] },
          category: { type: ['string', 'null'] },
          merchant: { type: ['string', 'null'] },
          splitResolution: {
            type: ['string', 'null'],
            enum: ['personal', 'split', null],
          },
          splitFactor: { type: ['integer', 'null'] },
        },
      },
    },
  },
} as const;

@Injectable()
export class CloudflarePersonalFollowUp {
  private readonly logger = new Logger(CloudflarePersonalFollowUp.name);

  constructor(
    @Optional() private readonly metrics?: AiMetricsService,
    @Optional()
    private readonly structuredProvider?: CloudflareStructuredModelProvider,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.structuredProvider?.isConfigured() && loadPennyGuidance(),
    );
  }

  /** Returns only proposed edits; the caller validates every field before applying them. */
  async interpret(
    text: string,
    drafts: PersonalDraftContext[],
    referenceTimestamp: string,
    timeZone?: string,
    mode: 'EDIT' | 'FILL_MISSING' = 'EDIT',
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<PersonalEditProposal[] | null> {
    const guidance = loadPennyGuidance();
    if (!guidance) return null;
    const queryJson = {
      mode,
      message: text,
      drafts,
      referenceTimestamp,
      timeZone: timeZone ?? null,
    };
    const provider = this.structuredProvider;
    if (!provider) return null;
    const result = await provider.generateStructured<unknown>(
      {
        temperature: PENNY_TEMPERATURE,
        maxCompletionTokens: PENNY_MAX_COMPLETION_TOKENS,
        responseSchema: PERSONAL_EDIT_SCHEMA,
        messages: [
          { role: 'system', content: guidance },
          {
            role: 'system',
            content:
              'Interpret the current personal-expense message against the supplied unsaved drafts. In EDIT mode, propose only changes explicitly requested in this follow-up. If the user explicitly asks to delete an unsaved draft, use action DELETE, choose its ordinal from the supplied drafts, and set all edit fields to null. Match a stated amount to the current draft amount; if several drafts match or the target is ambiguous, return an empty updates array. In FILL_MISSING mode, use only UPDATE and fill only fields currently missing from the initial draft when supported by the message. Use ordinal numbers from the draft list. Use null for every unchanged field. Copy changed amount and merchant text from the current message. Normalize a requested date to YYYY-MM-DD using the reference timestamp and time zone. For every FILL_MISSING date, dateEvidence MUST be an exact short substring of the original message containing BOTH the literal date phrase (for example today or yesterday) AND that draft amount. A quote containing only the amount or purchase is invalid. In "spent a lot today, almost 5000 on shopping and yesterday I have spent 500 tops", use "today, almost 5000" for draft 1 and "yesterday I have spent 500" for draft 2. If no such quote exists, leave date and dateEvidence null. Use null for dateEvidence when date is null or in EDIT mode. Category must be one of Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Health & Personal Care, Income, Other. If target or meaning is ambiguous, return an empty updates array. Never create a new transaction, calculate a share, or save anything. Output JSON matching the schema.',
          },
          {
            role: 'system',
            content:
              'For EDIT requests that say delete, remove, or discard drafts above or below an amount, compare the threshold with every supplied draft amount. Return one DELETE update for every matching ordinal and no others. Above 400 means strictly greater than 400: with draft amounts 180, 70, 350, 500, and 1000, delete ordinals 4 and 5. Keep all edit fields null. A threshold is a selection rule, not a draft amount.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              mode,
              message: text,
              drafts,
              referenceTimestamp,
              timeZone,
            }),
          },
        ],
      },
      (event) =>
        recordXpenseCloudflareTelemetry(
          this.logger,
          this.metrics,
          accessToken,
          { trace, route: 'personal-follow-up', queryJson },
          event,
        ),
    );
    if (result.status !== 'SUCCESS') return null;
    const parsed = result.value;
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.updates) ||
      parsed.updates.length > 20 ||
      !parsed.updates.every(
        (item: unknown) => isRecord(item) && Number.isInteger(item.ordinal),
      )
    ) {
      return null;
    }
    return parsed.updates as PersonalEditProposal[];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
