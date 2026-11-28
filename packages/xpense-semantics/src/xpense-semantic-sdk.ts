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
  XpenseSemanticOperation,
  XpenseSemanticRequest,
  XpenseSemanticResponse,
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

  isConfigured(
    kind: XpenseSemanticOperation = "TRANSACTION_SEGMENTATION",
  ): boolean {
    switch (kind) {
      case "TRANSACTION_SEGMENTATION":
        return this.transactionProvider.isConfigured();
      case "PEER_SPLIT":
      case "PEER_FOLLOW_UP":
        return this.splitInterpreter?.isConfigured() ?? false;
      case "PERSONAL_FOLLOW_UP":
        return this.personalInterpreter?.isConfigured() ?? false;
    }
  }

  /** Routes every semantic task through one stable public contract. */
  async interpret<T extends XpenseSemanticRequest>(
    request: T,
  ): Promise<XpenseSemanticResponse<T>> {
    let response:
      | string[]
      | ProposedSplit[]
      | SplitFollowUpProposal[]
      | PersonalEditProposal[]
      | null;

    switch (request.kind) {
      case "TRANSACTION_SEGMENTATION": {
        const input: TransactionSegmentationInput = request;
        const result = await this.engine.interpret(
          input,
          TRANSACTION_SEGMENTATION_DOMAIN,
          [this.transactionProvider],
        );
        response =
          result.status === "ACCEPTED" ? result.value.segments : null;
        break;
      }
      case "PEER_SPLIT":
        response = this.splitInterpreter
          ? await this.splitInterpreter.interpret(
              request.text,
              request.trace,
              request.accessToken,
            )
          : null;
        break;
      case "PEER_FOLLOW_UP":
        response = this.splitInterpreter
          ? await this.splitInterpreter.interpretFollowUp(
              request.text,
              request.pending,
              request.trace,
              request.accessToken,
            )
          : null;
        break;
      case "PERSONAL_FOLLOW_UP":
        response = this.personalInterpreter
          ? await this.personalInterpreter.interpret(
              request.text,
              request.drafts,
              request.referenceTimestamp,
              request.timeZone,
              request.mode ?? "EDIT",
              request.trace,
              request.accessToken,
            )
          : null;
        break;
    }

    return response as XpenseSemanticResponse<T>;
  }

  async segment(
    text: string,
    trace?: XpenseRequestTrace,
    accessToken?: string,
  ): Promise<string[] | null> {
    return this.interpret({
      kind: "TRANSACTION_SEGMENTATION",
      text,
      trace,
      accessToken,
    });
  }

  isPeerConfigured(): boolean {
    return this.isConfigured("PEER_SPLIT");
  }

  interpretPeerSplits(
    text: string,
    trace?: XpenseRequestTrace,
    accessToken?: string,
  ): Promise<ProposedSplit[] | null> {
    return this.interpret({ kind: "PEER_SPLIT", text, trace, accessToken });
  }

  interpretPeerFollowUp(
    text: string,
    pending: PendingSplitContext[],
    trace?: XpenseRequestTrace,
    accessToken?: string,
  ): Promise<SplitFollowUpProposal[] | null> {
    return this.interpret({
      kind: "PEER_FOLLOW_UP",
      text,
      pending,
      trace,
      accessToken,
    });
  }

  isPersonalFollowUpConfigured(): boolean {
    return this.isConfigured("PERSONAL_FOLLOW_UP");
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
    return this.interpret({
      kind: "PERSONAL_FOLLOW_UP",
      text,
      drafts,
      referenceTimestamp,
      timeZone,
      mode,
      trace,
      accessToken,
    });
  }
}
