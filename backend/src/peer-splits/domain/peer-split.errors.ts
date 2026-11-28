/**
 * Purpose: Contains the peer-split domain rules and calculations, independent of HTTP endpoints.
 */
import type { PeerSplitValidationIssue } from './peer-split.types';

export class PeerSplitValidationError extends Error {
  /** Creates this class and receives its required dependencies. */
  constructor(readonly issues: PeerSplitValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '));
    this.name = 'PeerSplitValidationError';
  }
}

export class PeerSplitInvariantError extends Error {
  /** Creates this class and receives its required dependencies. */
  constructor(message: string) {
    super(message);
    this.name = 'PeerSplitInvariantError';
  }
}
