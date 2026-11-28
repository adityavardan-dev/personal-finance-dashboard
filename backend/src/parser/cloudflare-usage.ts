/** Records Cloudflare token usage without printing prompts or model responses to server logs. */
import type { LoggerService } from '@nestjs/common';
import type { RequestTrace } from '../request-trace';

export const PENNY_TEMPERATURE = 0.3;
export const PENNY_MAX_COMPLETION_TOKENS = 1024;

export type CloudflareRequestOutcome =
  'SUCCESS' | 'HTTP_ERROR' | 'NETWORK_OR_RESPONSE_ERROR';

export interface CloudflareUsageContext {
  trace?: RequestTrace;
  route: string;
  model: string;
  outcome: CloudflareRequestOutcome;
  httpStatus?: number;
  envelope?: unknown;
  queryJson?: Record<string, unknown>;
}

/** Writes one structured usage event for a Cloudflare model request. */
export function logCloudflareUsage(
  logger: LoggerService,
  context: CloudflareUsageContext,
): void {
  const usage = readCloudflareUsage(context.envelope);
  logger.log(
    JSON.stringify({
      ...context.trace,
      event: 'cloudflare-ai-usage',
      route: context.route,
      model: context.model,
      temperature: PENNY_TEMPERATURE,
      maxCompletionTokens: PENNY_MAX_COMPLETION_TOKENS,
      outcome: context.outcome,
      httpStatus: context.httpStatus ?? null,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
      usageReported: usage !== null,
    }),
  );
}

/** Reads the OpenAI-compatible token counters returned by Cloudflare. */
export function readCloudflareUsage(envelope: unknown): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} | null {
  if (!isRecord(envelope) || !isRecord(envelope.usage)) return null;
  const inputTokens = nonNegativeInteger(envelope.usage.prompt_tokens);
  const outputTokens = nonNegativeInteger(envelope.usage.completion_tokens);
  const totalTokens = nonNegativeInteger(envelope.usage.total_tokens);
  if (inputTokens === null || outputTokens === null || totalTokens === null)
    return null;
  return { inputTokens, outputTokens, totalTokens };
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
