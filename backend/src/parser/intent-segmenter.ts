/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
export const INTENT_SEGMENTER = Symbol('INTENT_SEGMENTER');

export interface IntentSegmenter {
  isConfigured(): boolean;
  segment(text: string): Promise<string[] | null>;
}
