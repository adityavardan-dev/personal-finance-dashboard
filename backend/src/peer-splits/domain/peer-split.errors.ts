import type { PeerSplitValidationIssue } from './peer-split.types';

export class PeerSplitValidationError extends Error {
  constructor(readonly issues: PeerSplitValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '));
    this.name = 'PeerSplitValidationError';
  }
}

export class PeerSplitInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeerSplitInvariantError';
  }
}
