/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import { Module } from '@nestjs/common';
import { ParserController } from './parser.controller';
import { ParserService } from './parser.service';
import { IntentService } from './intent.service';
import { CloudflareIntentSegmenter } from './cloudflare-intent-segmenter';
import { INTENT_SEGMENTER } from './intent-segmenter';
import { CloudflareSplitInterpreter } from './cloudflare-split-interpreter';
import { SplitIntentService } from './split-intent.service';
import { SplitFollowUpService } from './split-follow-up.service';
import { CloudflarePersonalFollowUp } from './cloudflare-personal-follow-up';
import { PersonalFollowUpService } from './personal-follow-up.service';
import { AiMetricsService } from './ai-metrics.service';

@Module({
  controllers: [ParserController],
  providers: [
    ParserService,
    IntentService,
    CloudflareIntentSegmenter,
    CloudflareSplitInterpreter,
    SplitIntentService,
    SplitFollowUpService,
    CloudflarePersonalFollowUp,
    PersonalFollowUpService,
    AiMetricsService,
    { provide: INTENT_SEGMENTER, useExisting: CloudflareIntentSegmenter },
  ],
  exports: [ParserService],
})
export class ParserModule {}
