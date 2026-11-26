/** Public XPENSE semantic facade; application services depend on this, not a vendor. */
import { Injectable, Optional } from '@nestjs/common';
import type { RequestTrace } from '../request-trace';
import { SemanticEngine } from '../semantic-sdk';
import type { IntentSegmenter } from '../parser/intent-segmenter';
import {
  CloudflareSplitInterpreter,
  type ProposedSplit,
} from '../parser/cloudflare-split-interpreter';
import {
  CloudflarePersonalFollowUp,
  type PersonalDraftContext,
  type PersonalEditProposal,
} from '../parser/cloudflare-personal-follow-up';
import type {
  PendingSplitContext,
  SplitFollowUpProposal,
} from '../parser/split-follow-up.service';
import { CloudflareTransactionSegmentationProvider } from './cloudflare-transaction-segmentation.provider';
import {
  TRANSACTION_SEGMENTATION_DOMAIN,
  type TransactionSegmentationInput,
} from './transaction-segmentation.domain';

@Injectable()
export class XpenseSemanticSdk implements IntentSegmenter {
  constructor(
    private readonly engine: SemanticEngine,
    private readonly transactionProvider: CloudflareTransactionSegmentationProvider,
    @Optional() private readonly splitInterpreter?: CloudflareSplitInterpreter,
    @Optional()
    private readonly personalInterpreter?: CloudflarePersonalFollowUp,
  ) {}

  isConfigured(): boolean {
    return this.transactionProvider.isConfigured();
  }

  async segment(
    text: string,
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<string[] | null> {
    const input: TransactionSegmentationInput = { text, trace, accessToken };
    const result = await this.engine.interpret(
      input,
      TRANSACTION_SEGMENTATION_DOMAIN,
      [this.transactionProvider],
    );
    return result.status === 'ACCEPTED' ? result.value.segments : null;
  }

  isPeerConfigured(): boolean {
    return this.splitInterpreter?.isConfigured() ?? false;
  }

  interpretPeerSplits(
    text: string,
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<ProposedSplit[] | null> {
    return (
      this.splitInterpreter?.interpret(text, trace, accessToken) ??
      Promise.resolve(null)
    );
  }

  interpretPeerFollowUp(
    text: string,
    pending: PendingSplitContext[],
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<SplitFollowUpProposal[] | null> {
    return (
      this.splitInterpreter?.interpretFollowUp(
        text,
        pending,
        trace,
        accessToken,
      ) ?? Promise.resolve(null)
    );
  }

  isPersonalFollowUpConfigured(): boolean {
    return this.personalInterpreter?.isConfigured() ?? false;
  }

  interpretPersonalFollowUp(
    text: string,
    drafts: PersonalDraftContext[],
    referenceTimestamp: string,
    timeZone?: string,
    mode: 'EDIT' | 'FILL_MISSING' = 'EDIT',
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<PersonalEditProposal[] | null> {
    return (
      this.personalInterpreter?.interpret(
        text,
        drafts,
        referenceTimestamp,
        timeZone,
        mode,
        trace,
        accessToken,
      ) ?? Promise.resolve(null)
    );
  }
}
