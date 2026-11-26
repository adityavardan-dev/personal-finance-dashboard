/** Reusable Cloudflare structured-output transport; it contains no XPENSE rules. */
import type { SemanticProviderResult } from '../contracts';

const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';

export interface StructuredModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CloudflareStructuredModelRequest {
  messages: StructuredModelMessage[];
  responseSchema: Record<string, unknown>;
  temperature: number;
  maxCompletionTokens: number;
  timeoutMs?: number;
  model?: string;
}

export interface CloudflareTelemetryEvent {
  model: string;
  outcome: 'SUCCESS' | 'HTTP_ERROR' | 'NETWORK_OR_RESPONSE_ERROR';
  httpStatus?: number;
  envelope?: unknown;
}

export type CloudflareTelemetryHandler = (
  event: CloudflareTelemetryEvent,
) => void | Promise<void>;

export class CloudflareStructuredModelProvider {
  readonly name = 'cloudflare';

  isConfigured(): boolean {
    return Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_AI_API_TOKEN?.trim(),
    );
  }

  async generateStructured<T>(
    request: CloudflareStructuredModelRequest,
    telemetry?: CloudflareTelemetryHandler,
  ): Promise<SemanticProviderResult<T>> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
    if (!accountId || !apiToken) {
      return { status: 'UNAVAILABLE', reason: 'Cloudflare is not configured.' };
    }

    const model =
      request.model?.trim() ||
      process.env.CLOUDFLARE_AI_MODEL?.trim() ||
      DEFAULT_MODEL;
    let httpStatus: number | undefined;
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(request.timeoutMs ?? 20000),
          body: JSON.stringify({
            model,
            stream: false,
            temperature: request.temperature,
            max_completion_tokens: request.maxCompletionTokens,
            chat_template_kwargs: { enable_thinking: false },
            response_format: {
              type: 'json_schema',
              json_schema: request.responseSchema,
            },
            messages: request.messages,
          }),
        },
      );
      httpStatus = response.status;
      if (!response.ok) {
        const envelope = await response
          .clone()
          .json()
          .catch(() => null);
        await telemetry?.({
          model,
          outcome: 'HTTP_ERROR',
          httpStatus,
          envelope,
        });
        return this.availabilityStatus(httpStatus);
      }

      const envelope: unknown = await response.json();
      await telemetry?.({ model, outcome: 'SUCCESS', httpStatus, envelope });
      const content = this.readAssistantContent(envelope);
      if (!content) {
        return {
          status: 'INVALID_RESPONSE',
          reason: 'Assistant content is missing.',
        };
      }
      try {
        return { status: 'SUCCESS', value: JSON.parse(content) as T };
      } catch {
        return {
          status: 'INVALID_RESPONSE',
          reason: 'Assistant content is not JSON.',
        };
      }
    } catch {
      await telemetry?.({
        model,
        outcome: 'NETWORK_OR_RESPONSE_ERROR',
        httpStatus,
      });
      return { status: 'UNAVAILABLE', reason: 'Cloudflare request failed.' };
    }
  }

  private availabilityStatus(
    httpStatus: number,
  ): SemanticProviderResult<never> {
    return httpStatus === 408 || httpStatus === 429 || httpStatus >= 500
      ? { status: 'UNAVAILABLE', reason: `Cloudflare returned ${httpStatus}.` }
      : {
          status: 'INVALID_RESPONSE',
          reason: `Cloudflare rejected the request with ${httpStatus}.`,
        };
  }

  private readAssistantContent(envelope: unknown): string | null {
    if (!isRecord(envelope) || !Array.isArray(envelope.choices)) return null;
    const firstChoice: unknown = envelope.choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
    return typeof firstChoice.message.content === 'string'
      ? firstChoice.message.content
      : null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
