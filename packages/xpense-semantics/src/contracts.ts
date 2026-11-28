import type { SemanticModelProvider } from "@adityavardan/semantic-core";

export interface XpenseRequestTrace {
  conversationId: string;
  requestId: string;
}

export interface TransactionSegmentationInput {
  text: string;
  trace?: XpenseRequestTrace;
  accessToken?: string;
}

export interface TransactionSegmentationProposal {
  segments: string[];
}

export type TransactionSegmentationProvider = SemanticModelProvider<
  TransactionSegmentationInput,
  TransactionSegmentationProposal
>;

export interface ProposedSplit {
  amount: string;
  peopleCount: string;
  participants?: string[];
  paidBy?: string | null;
  allocationKind?: "EQUAL" | "FULL_TO_OTHER";
  beneficiary?: string | null;
}

export interface PendingSplitContext {
  ordinal: number;
  peopleCount: number;
  amountMinor?: number;
  names?: string[];
  paidBy?: string;
}

export interface SplitFollowUpProposal {
  ordinal: number;
  names?: string[] | null;
  paidBy?: string | null;
  amount?: string | null;
  peopleCount?: number | null;
}

export interface PersonalDraftContext {
  ordinal: number;
  amount: number | null;
  category: string;
  merchant: string;
  date: string;
  note: string;
  splitResolution: string;
  splitFactor: number | null;
}

export interface PersonalEditProposal {
  ordinal: number;
  action?: "UPDATE" | "DELETE";
  amount: string | null;
  date: string | null;
  dateEvidence?: string | null;
  category: string | null;
  merchant: string | null;
  splitResolution: "personal" | "split" | null;
  splitFactor: number | null;
}

export interface PeerSemanticInterpreter {
  isConfigured(): boolean;
  interpret(
    text: string,
    trace?: XpenseRequestTrace,
    accessToken?: string,
  ): Promise<ProposedSplit[] | null>;
  interpretFollowUp(
    text: string,
    pending: PendingSplitContext[],
    trace?: XpenseRequestTrace,
    accessToken?: string,
  ): Promise<SplitFollowUpProposal[] | null>;
}

export interface PersonalSemanticInterpreter {
  isConfigured(): boolean;
  interpret(
    text: string,
    drafts: PersonalDraftContext[],
    referenceTimestamp: string,
    timeZone?: string,
    mode?: "EDIT" | "FILL_MISSING",
    trace?: XpenseRequestTrace,
    accessToken?: string,
  ): Promise<PersonalEditProposal[] | null>;
}

interface XpenseSemanticRequestBase {
  text: string;
  trace?: XpenseRequestTrace;
  accessToken?: string;
}

export interface TransactionSegmentationRequest
  extends XpenseSemanticRequestBase {
  kind: "TRANSACTION_SEGMENTATION";
}

export interface PeerSplitRequest extends XpenseSemanticRequestBase {
  kind: "PEER_SPLIT";
}

export interface PeerFollowUpRequest extends XpenseSemanticRequestBase {
  kind: "PEER_FOLLOW_UP";
  pending: PendingSplitContext[];
}

export interface PersonalFollowUpRequest extends XpenseSemanticRequestBase {
  kind: "PERSONAL_FOLLOW_UP";
  drafts: PersonalDraftContext[];
  referenceTimestamp: string;
  timeZone?: string;
  mode?: "EDIT" | "FILL_MISSING";
}

/** One public request contract for every XPENSE semantic operation. */
export type XpenseSemanticRequest =
  | TransactionSegmentationRequest
  | PeerSplitRequest
  | PeerFollowUpRequest
  | PersonalFollowUpRequest;

export type XpenseSemanticOperation = XpenseSemanticRequest["kind"];

export type XpenseSemanticResponse<T extends XpenseSemanticRequest> =
  T extends TransactionSegmentationRequest
    ? string[] | null
    : T extends PeerSplitRequest
      ? ProposedSplit[] | null
      : T extends PeerFollowUpRequest
        ? SplitFollowUpProposal[] | null
        : T extends PersonalFollowUpRequest
          ? PersonalEditProposal[] | null
          : never;
