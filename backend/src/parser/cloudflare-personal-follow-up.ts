/** Requests structured edits to existing personal expense drafts from PENNY. */
import { Injectable, Logger, Optional } from '@nestjs/common';
import type { RequestTrace } from '../request-trace';
import {
  logCloudflareUsage,
  PENNY_MAX_COMPLETION_TOKENS,
  PENNY_TEMPERATURE,
  type CloudflareUsageContext,
} from './cloudflare-usage';
import { AiMetricsService } from './ai-metrics.service';
import { loadPennyGuidance } from './penny-guidance';

export interface PersonalDraftContext {
  ordinal: number;
  amount: number | null;
  category: string;
  merchant: string;
  date: string;
  note: string;
  splitResolution: string;
  splitFactor: number | null;
}

export interface PersonalEditProposal {
  ordinal: number;
  action?: 'UPDATE' | 'DELETE';
  amount: string | null;
  date: string | null;
  category: string | null;
  merchant: string | null;
  splitResolution: 'personal' | 'split' | null;
  splitFactor: number | null;
}

const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';

@Injectable()
export class CloudflarePersonalFollowUp {
  private readonly logger = new Logger(CloudflarePersonalFollowUp.name);

  constructor(@Optional() private readonly metrics?: AiMetricsService) {}

  isConfigured(): boolean {
    return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_AI_API_TOKEN?.trim() && loadPennyGuidance());
  }

  /** Returns only proposed edits; the caller validates every field before applying them. */
  async interpret(text: string, drafts: PersonalDraftContext[], referenceTimestamp: string, timeZone?: string, mode: 'EDIT' | 'FILL_MISSING' = 'EDIT', trace?: RequestTrace, accessToken?: string): Promise<PersonalEditProposal[] | null> {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const token = process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
    const guidance = loadPennyGuidance();
    if (!account || !token || !guidance) return null;
    const model = process.env.CLOUDFLARE_AI_MODEL?.trim() || DEFAULT_MODEL;
    let usageLogged = false;
    let httpStatus: number | undefined;
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/v1/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model,
          stream: false,
          temperature: PENNY_TEMPERATURE,
          max_completion_tokens: PENNY_MAX_COMPLETION_TOKENS,
          chat_template_kwargs: { enable_thinking: false },
          response_format: {
            type: 'json_schema',
            json_schema: {
              type: 'object', additionalProperties: false, required: ['updates'],
              properties: { updates: { type: 'array', minItems: 0, maxItems: 20, items: {
                type: 'object', additionalProperties: false,
                required: ['ordinal', 'action', 'amount', 'date', 'category', 'merchant', 'splitResolution', 'splitFactor'],
                properties: {
                  ordinal: { type: 'integer' }, action: { type: 'string', enum: ['UPDATE', 'DELETE'] },
                  amount: { type: ['string', 'null'] }, date: { type: ['string', 'null'] },
                  category: { type: ['string', 'null'] }, merchant: { type: ['string', 'null'] },
                  splitResolution: { type: ['string', 'null'], enum: ['personal', 'split', null] },
                  splitFactor: { type: ['integer', 'null'] },
                },
              } } },
            },
          },
          messages: [
            { role: 'system', content: guidance },
            { role: 'system', content: 'Interpret the current personal-expense message against the supplied unsaved drafts. In EDIT mode, propose only changes explicitly requested in this follow-up. If the user explicitly asks to delete an unsaved draft, use action DELETE, choose its ordinal from the supplied drafts, and set all edit fields to null. Match a stated amount to the current draft amount; if several drafts match or the target is ambiguous, return an empty updates array. In FILL_MISSING mode, use only UPDATE and fill only fields currently missing from the initial draft when supported by the message. Use ordinal numbers from the draft list. Use null for every unchanged field. Copy changed amount and merchant text from the current message. Normalize a requested date to YYYY-MM-DD using the reference timestamp and time zone. Category must be one of Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Health & Personal Care, Income, Other. If target or meaning is ambiguous, return an empty updates array. Never create a new transaction, calculate a share, or save anything. Output JSON matching the schema.' },
            { role: 'user', content: JSON.stringify({ mode, message: text, drafts, referenceTimestamp, timeZone }) },
          ],
        }),
      });
      httpStatus = response.status;
      if (!response.ok) {
        const usageContext: CloudflareUsageContext = { trace, route: 'personal-follow-up', model, outcome: 'HTTP_ERROR', httpStatus };
        logCloudflareUsage(this.logger, usageContext);
        await this.metrics?.record(accessToken, usageContext);
        usageLogged = true;
        return null;
      }
      const body: unknown = await response.json();
      const usageContext: CloudflareUsageContext = { trace, route: 'personal-follow-up', model, outcome: 'SUCCESS', httpStatus, envelope: body };
      logCloudflareUsage(this.logger, usageContext);
      await this.metrics?.record(accessToken, usageContext);
      usageLogged = true;
      if (!isRecord(body) || !Array.isArray(body.choices)) return null;
      const first: unknown = body.choices[0];
      if (!isRecord(first) || !isRecord(first.message) || typeof first.message.content !== 'string') return null;
      const parsed: unknown = JSON.parse(first.message.content);
      if (!isRecord(parsed) || !Array.isArray(parsed.updates) || parsed.updates.length > 20) return null;
      if (!parsed.updates.every((item: unknown) => isRecord(item) && Number.isInteger(item.ordinal))) return null;
      return parsed.updates as PersonalEditProposal[];
    } catch {
      if (!usageLogged) {
        const usageContext: CloudflareUsageContext = { trace, route: 'personal-follow-up', model, outcome: 'NETWORK_OR_RESPONSE_ERROR', httpStatus };
        logCloudflareUsage(this.logger, usageContext);
        await this.metrics?.record(accessToken, usageContext);
      }
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
