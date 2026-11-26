/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { recordXpenseCloudflareTelemetry } from '../expense-semantics/xpense-cloudflare-telemetry';
import type { RequestTrace } from '../request-trace';
import { CloudflareStructuredModelProvider } from '../semantic-sdk';
import type { IntentSegmenter } from './intent-segmenter';
import { loadPennyGuidance } from './penny-guidance';
import {
  PENNY_MAX_COMPLETION_TOKENS,
  PENNY_TEMPERATURE,
} from './cloudflare-usage';
import { AiMetricsService } from './ai-metrics.service';

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

  constructor(
    @Optional() private readonly metrics?: AiMetricsService,
    @Optional()
    private readonly structuredProvider?: CloudflareStructuredModelProvider,
  ) {}

  /** Checks whether is configured. */
  isConfigured(): boolean {
    return Boolean(
      (
        this.structuredProvider ?? new CloudflareStructuredModelProvider()
      ).isConfigured() && loadPennyGuidance(),
    );
  }

  /** Provides segment. */
  async segment(
    text: string,
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<string[] | null> {
    const guidance = loadPennyGuidance();
    if (!guidance) return null;
    const queryJson = { message: text };

    const provider =
      this.structuredProvider ?? new CloudflareStructuredModelProvider();
    const result = await provider.generateStructured<unknown>(
      {
        temperature: PENNY_TEMPERATURE,
        maxCompletionTokens: PENNY_MAX_COMPLETION_TOKENS,
        responseSchema: SEGMENT_SCHEMA,
        messages: [
          {
            role: 'system',
            content:
              `${guidance}\n\nTask: ` +
              'You extract transaction boundaries. Each segment MUST be one exact, contiguous substring copied from the user text. Each segment MUST keep a description together with its numeric amount. Never return a bare description, a bare amount, or a date by itself. Preserve original capitalization, spelling, currency, dates, and order. Do not invent, rewrite, or calculate facts. Example input: Coffee ₹180 metro ₹70 today. Correct output: {"segments":["Coffee ₹180","metro ₹70 today"]}. Return JSON matching the schema.',
          },
          { role: 'user', content: text },
        ],
      },
      (event) =>
        recordXpenseCloudflareTelemetry(
          this.logger,
          this.metrics,
          accessToken,
          { trace, route: 'parse-batch-segmentation', queryJson },
          event,
        ),
    );

    if (result.status !== 'SUCCESS') return null;
    const parsed = result.value;
    if (
      !isRecord(parsed) ||
      Object.keys(parsed).some((key) => key !== 'segments') ||
      !Array.isArray(parsed.segments) ||
      parsed.segments.length < 2 ||
      parsed.segments.length > 20 ||
      !parsed.segments.every((item) => typeof item === 'string' && item.trim())
    ) {
      return null;
    }
    return parsed.segments as string[];
  }
}

/** Checks whether is record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
