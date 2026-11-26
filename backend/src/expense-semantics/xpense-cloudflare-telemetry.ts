/** Bridges reusable provider telemetry to XPENSE logging and authenticated metrics. */
import type { LoggerService } from '@nestjs/common';
import type { RequestTrace } from '../request-trace';
import type { CloudflareTelemetryEvent } from '../semantic-sdk/providers/cloudflare-structured-model.provider';
import type { AiMetricsService } from '../parser/ai-metrics.service';
import { logCloudflareUsage } from '../parser/cloudflare-usage';

export async function recordXpenseCloudflareTelemetry(
  logger: LoggerService,
  metrics: AiMetricsService | undefined,
  accessToken: string | undefined,
  context: {
    trace?: RequestTrace;
    route: string;
    queryJson?: Record<string, unknown>;
  },
  event: CloudflareTelemetryEvent,
): Promise<void> {
  const usageContext = {
    ...context,
    model: event.model,
    outcome: event.outcome,
    httpStatus: event.httpStatus,
    envelope: event.envelope,
  };
  logCloudflareUsage(logger, usageContext);
  await metrics?.record(accessToken, usageContext);
}
