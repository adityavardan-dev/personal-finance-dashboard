import { SemanticEngine } from "@adityavardan/semantic-core";
import type {
  PeerSemanticInterpreter,
  PendingSplitContext,
  PersonalDraftContext,
  PersonalEditProposal,
  PersonalSemanticInterpreter,
  ProposedSplit,
  SplitFollowUpProposal,
  TransactionSegmentationInput,
  TransactionSegmentationProvider,
  XpenseRequestTrace,
} from "./contracts";
import { TRANSACTION_SEGMENTATION_DOMAIN } from "./transaction-segmentation.domain";

/** Public XPENSE facade with adapters supplied by the consuming application. */
export class XpenseSemanticSdk {
  constructor(
    private readonly engine: SemanticEngine,
    private readonly transactionProvider: TransactionSegmentationProvider,
    private readonly splitInterpreter?: PeerSemanticInterpreter,
    private readonly personalInterpreter?: PersonalSemanticInterpreter,
  ) {}

  isConfigured(): boolean {
    return this.transactionProvider.isConfigured();
  }

  async segment(
    text: string,
    trace?: XpenseRequestTrace,
    accessToken?: string,
  ): Promise<string[] | null> {
    const input: TransactionSegmentationInput = { text, trace, accessToken };
    const result = await this.engine.interpret(
      input,
      TRANSACTION_SEGMENTATION_DOMAIN,
      [this.transactionProvider],
    );
    return result.status === "ACCEPTED" ? result.value.segments : null;
  }

  isPeerConfigured(): boolean {
    return this.splitInterpreter?.isConfigured() ?? false;
  }

  interpretPeerSplits(
    text: string,
    trace?: XpenseRequestTrace,
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
    trace?: XpenseRequestTrace,
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
    mode: "EDIT" | "FILL_MISSING" = "EDIT",
    trace?: XpenseRequestTrace,
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
