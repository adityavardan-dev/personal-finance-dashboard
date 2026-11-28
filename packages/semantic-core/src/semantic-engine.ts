// Copyright 2026 Adityavardan. Licensed under the Apache License, Version 2.0.

import type {
  SemanticDomain,
  SemanticInterpretationResult,
  SemanticModelProvider,
  SemanticProviderAttempt,
} from "./contracts";

/** Executes one primary and at most one availability fallback. */
export class SemanticEngine {
  async interpret<TInput, TProposal>(
    input: TInput,
    domain: SemanticDomain<TInput, TProposal>,
    providers: ReadonlyArray<SemanticModelProvider<TInput, TProposal>>,
  ): Promise<SemanticInterpretationResult<TProposal>> {
    const configured = providers
      .filter((provider) => provider.isConfigured())
      .slice(0, 2);
    const attempts: SemanticProviderAttempt[] = [];

    for (const provider of configured) {
      const result = await provider.extract(input);
      if (result.status === "UNAVAILABLE") {
        attempts.push({ provider: provider.name, outcome: "UNAVAILABLE" });
        continue;
      }
      if (result.status === "INVALID_RESPONSE") {
        attempts.push({ provider: provider.name, outcome: "INVALID_RESPONSE" });
        return this.rejected(attempts);
      }
      if (!domain.validate(result.value, input)) {
        attempts.push({ provider: provider.name, outcome: "DOMAIN_REJECTED" });
        return this.rejected(attempts);
      }
      attempts.push({ provider: provider.name, outcome: "ACCEPTED" });
      return {
        status: "ACCEPTED",
        source: "MODEL",
        value: result.value,
        providerAttempted: true,
        providerAccepted: true,
        provider: provider.name,
        attempts,
      };
    }

    return {
      status: "UNAVAILABLE",
      source: "NONE",
      value: null,
      providerAttempted: attempts.length > 0,
      providerAccepted: false,
      provider: null,
      attempts,
    };
  }

  private rejected<T>(
    attempts: SemanticProviderAttempt[],
  ): SemanticInterpretationResult<T> {
    return {
      status: "REJECTED",
      source: "NONE",
      value: null,
      providerAttempted: true,
      providerAccepted: false,
      provider: null,
      attempts,
    };
  }
}
