// Copyright 2026 Adityavardan. Licensed under the Apache License, Version 2.0.

export type SemanticProviderResult<T> =
  | { status: "SUCCESS"; value: T }
  | { status: "UNAVAILABLE"; reason?: string }
  | { status: "INVALID_RESPONSE"; reason?: string };

export interface SemanticModelProvider<TInput, TProposal> {
  readonly name: string;
  isConfigured(): boolean;
  extract(input: TInput): Promise<SemanticProviderResult<TProposal>>;
}

export interface SemanticDomain<TInput, TProposal> {
  readonly name: string;
  readonly schemaVersion: number;
  validate(proposal: TProposal, input: TInput): boolean;
}

export interface SemanticProviderAttempt {
  provider: string;
  outcome: "ACCEPTED" | "UNAVAILABLE" | "INVALID_RESPONSE" | "DOMAIN_REJECTED";
}

export type SemanticInterpretationResult<T> =
  | {
      status: "ACCEPTED";
      source: "MODEL";
      value: T;
      providerAttempted: true;
      providerAccepted: true;
      provider: string;
      attempts: SemanticProviderAttempt[];
    }
  | {
      status: "UNAVAILABLE" | "REJECTED";
      source: "NONE";
      value: null;
      providerAttempted: boolean;
      providerAccepted: false;
      provider: null;
      attempts: SemanticProviderAttempt[];
    };
