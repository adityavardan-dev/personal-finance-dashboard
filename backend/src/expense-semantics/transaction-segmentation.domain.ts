/** XPENSE domain contract for separating one message into transaction substrings. */
import type { RequestTrace } from '../request-trace';
import type { SemanticDomain } from '../semantic-sdk';

export interface TransactionSegmentationInput {
  text: string;
  trace?: RequestTrace;
  accessToken?: string;
}

export interface TransactionSegmentationProposal {
  segments: string[];
}

export const TRANSACTION_SEGMENTATION_DOMAIN: SemanticDomain<
  TransactionSegmentationInput,
  TransactionSegmentationProposal
> = {
  name: 'xpense.transaction-segmentation',
  schemaVersion: 1,
  validate(proposal, input): boolean {
    if (proposal.segments.length < 2 || proposal.segments.length > 20)
      return false;
    let position = 0;
    const source = input.text.toLocaleLowerCase();
    for (const segment of proposal.segments) {
      if (!segment.trim()) return false;
      const index = source.indexOf(segment.toLocaleLowerCase(), position);
      if (index < 0) return false;
      position = index + segment.length;
    }
    return true;
  },
};
