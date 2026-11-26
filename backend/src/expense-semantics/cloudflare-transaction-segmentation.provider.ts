/** Adapts the current Cloudflare segmenter to the provider-neutral semantic port. */
import { Injectable } from '@nestjs/common';
import { CloudflareIntentSegmenter } from '../parser/cloudflare-intent-segmenter';
import type {
  SemanticModelProvider,
  SemanticProviderResult,
} from '../semantic-sdk';
import type {
  TransactionSegmentationInput,
  TransactionSegmentationProposal,
} from './transaction-segmentation.domain';

@Injectable()
export class CloudflareTransactionSegmentationProvider implements SemanticModelProvider<
  TransactionSegmentationInput,
  TransactionSegmentationProposal
> {
  readonly name = 'cloudflare-gemma';

  constructor(private readonly segmenter: CloudflareIntentSegmenter) {}

  isConfigured(): boolean {
    return this.segmenter.isConfigured();
  }

  async extract(
    input: TransactionSegmentationInput,
  ): Promise<SemanticProviderResult<TransactionSegmentationProposal>> {
    const segments = await this.segmenter.segment(
      input.text,
      input.trace,
      input.accessToken,
    );
    return segments
      ? { status: 'SUCCESS', value: { segments } }
      : {
          status: 'INVALID_RESPONSE',
          reason: 'Provider returned no usable segments.',
        };
  }
}
