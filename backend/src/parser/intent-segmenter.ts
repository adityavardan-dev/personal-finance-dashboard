/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import type { RequestTrace } from '../request-trace';

export const INTENT_SEGMENTER = Symbol('INTENT_SEGMENTER');

export interface IntentSegmenter {
  isConfigured(): boolean;
  segment(
    text: string,
    trace?: RequestTrace,
    accessToken?: string,
  ): Promise<string[] | null>;
}
