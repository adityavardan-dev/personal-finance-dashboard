/** Persists per-request Cloudflare usage metrics through authenticated Supabase RLS. */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  PENNY_MAX_COMPLETION_TOKENS,
  PENNY_TEMPERATURE,
  readCloudflareUsage,
  type CloudflareUsageContext,
} from './cloudflare-usage';

@Injectable()
export class AiMetricsService {
  private readonly logger = new Logger(AiMetricsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Inserts one immutable metric row; monitoring failures never fail the user request. */
  async record(
    accessToken: string | undefined,
    context: CloudflareUsageContext,
  ): Promise<void> {
    if (!accessToken || !context.trace) return;
    const usage = readCloudflareUsage(context.envelope);
    try {
      await this.supabase.data<null>(accessToken, 'ai_request_metrics', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          conversation_id: context.trace.conversationId,
          request_id: context.trace.requestId,
          route: context.route,
          model: context.model,
          temperature: PENNY_TEMPERATURE,
          max_completion_tokens: PENNY_MAX_COMPLETION_TOKENS,
          input_tokens: usage?.inputTokens ?? null,
          output_tokens: usage?.outputTokens ?? null,
          total_tokens: usage?.totalTokens ?? null,
          outcome: context.outcome,
          http_status: context.httpStatus ?? null,
          usage_reported: usage !== null,
          query_json: context.queryJson ?? null,
          response_json: context.envelope ?? null,
        }),
      });
    } catch {
      this.logger.warn(
        JSON.stringify({
          ...context.trace,
          event: 'ai-metrics-persist-failed',
          route: context.route,
        }),
      );
    }
  }
}
