/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import { Module } from '@nestjs/common';
import { ParserController } from './parser.controller';
import { ParserService } from './parser.service';
import { IntentService } from './intent.service';
import { CloudflareIntentSegmenter } from './cloudflare-intent-segmenter';
import { INTENT_SEGMENTER } from './intent-segmenter';

@Module({
  controllers: [ParserController],
  providers: [
    ParserService,
    IntentService,
    CloudflareIntentSegmenter,
    { provide: INTENT_SEGMENTER, useExisting: CloudflareIntentSegmenter },
  ],
  exports: [ParserService],
})
export class ParserModule {}
