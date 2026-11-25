/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import type { RequestTrace } from '../request-trace';
import type { IntentSegmenter } from './intent-segmenter';
import { loadPennyGuidance } from './penny-guidance';
import {
  logCloudflareUsage,
  PENNY_MAX_COMPLETION_TOKENS,
  PENNY_TEMPERATURE,
  type CloudflareUsageContext,
} from './cloudflare-usage';
import { AiMetricsService } from './ai-metrics.service';

const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';

const SEGMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['segments'],
  properties: {
    segments: {
      type: 'array',
      minItems: 2,
      maxItems: 20,
      items: { type: 'string', minLength: 2 },
    },
  },
} as const;

@Injectable()
export class CloudflareIntentSegmenter implements IntentSegmenter {
  private readonly logger = new Logger(CloudflareIntentSegmenter.name);

  constructor(@Optional() private readonly metrics?: AiMetricsService) {}

  /** Checks whether is configured. */
  isConfigured(): boolean {
    return Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_AI_API_TOKEN?.trim() &&
      loadPennyGuidance(),
    );
  }

  /** Provides segment. */
  async segment(
    text: string,
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<string[] | null> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
    const guidance = loadPennyGuidance();
    if (!accountId || !apiToken || !guidance) return null;

    const model = process.env.CLOUDFLARE_AI_MODEL?.trim() || DEFAULT_MODEL;
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;
    const queryJson = { message: text };

    let usageLogged = false;
    let httpStatus: number | undefined;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model,
          stream: false,
          temperature: PENNY_TEMPERATURE,
          max_completion_tokens: PENNY_MAX_COMPLETION_TOKENS,
          chat_template_kwargs: { enable_thinking: false },
          response_format: {
            type: 'json_schema',
            json_schema: SEGMENT_SCHEMA,
          },
          messages: [
            {
              role: 'system',
              content:
                `${guidance}\n\nTask: ` +
                'You extract transaction boundaries. Each segment MUST be one exact, contiguous substring copied from the user text. Each segment MUST keep a description together with its numeric amount. Never return a bare description, a bare amount, or a date by itself. Preserve original capitalization, spelling, currency, dates, and order. Do not invent, rewrite, or calculate facts. Example input: Coffee ₹180 metro ₹70 today. Correct output: {"segments":["Coffee ₹180","metro ₹70 today"]}. Return JSON matching the schema.',
            },
            { role: 'user', content: text },
          ],
        }),
      });

      httpStatus = response.status;
      if (!response.ok) {
        const usageContext: CloudflareUsageContext = {
          trace,
          route: 'parse-batch-segmentation',
          model,
          outcome: 'HTTP_ERROR',
          httpStatus,
          queryJson,
          envelope: await response.clone().json().catch(() => null),
        };
        logCloudflareUsage(this.logger, usageContext);
        await this.metrics?.record(accessToken, usageContext);
        usageLogged = true;
        return null;
      }
      const envelope: unknown = await response.json();
      const usageContext: CloudflareUsageContext = {
        trace,
        route: 'parse-batch-segmentation',
        model,
        outcome: 'SUCCESS',
        httpStatus,
        envelope,
        queryJson,
      };
      logCloudflareUsage(this.logger, usageContext);
      await this.metrics?.record(accessToken, usageContext);
      usageLogged = true;
      const content = readAssistantContent(envelope);
      if (!content) return null;

      const parsed: unknown = JSON.parse(content);
      if (
        !isRecord(parsed) ||
        Object.keys(parsed).some((key) => key !== 'segments')
      ) {
        return null;
      }

      const segments = parsed.segments;
      if (
        !Array.isArray(segments) ||
        segments.length < 2 ||
        segments.length > 20 ||
        !segments.every((item) => typeof item === 'string' && item.trim())
      ) {
        return null;
      }

      return segments as string[];
    } catch {
      if (!usageLogged) {
        const usageContext: CloudflareUsageContext = {
          trace,
          route: 'parse-batch-segmentation',
          model,
          outcome: 'NETWORK_OR_RESPONSE_ERROR',
          httpStatus,
          queryJson,
        };
        logCloudflareUsage(this.logger, usageContext);
        await this.metrics?.record(accessToken, usageContext);
      }
      return null;
    }
  }
}

/** Returns read assistant content. */
function readAssistantContent(envelope: unknown): string | null {
  if (!isRecord(envelope) || !Array.isArray(envelope.choices)) return null;
  const firstChoice: unknown = envelope.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  return typeof firstChoice.message.content === 'string'
    ? firstChoice.message.content
    : null;
}

/** Checks whether is record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
