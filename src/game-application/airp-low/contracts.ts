import type { Message, SourceDocument, Usage } from "../airp-generation/contracts";

export type LowExpressions = { common: Record<string, string>; actors: { id: string; name: string; specials: string[] }[]; player: { id: string; name: string } };
export type LowSampling = { stream: true; temperature: number; top_p: number; max_tokens: number; frequency_penalty: number; presence_penalty: number; reasoning_effort: string; n: 1 };
export type LowMaterial = { version: 1; preset: string; sources: SourceDocument[]; common: Record<string, string>; specials: Record<string, string[]> };
export type LowScene = { id: string; actors: Record<string, string>; player: { id: string; name: string }; scenario: string; userInput: string;
  /** Runtime task appended after the versioned preset modules. */
  currentTurn?: string;
  /** Opt-in contextual character rules and elastic length; absent on historical r8 frames. */
  proseVersion?: 1;
  /** Structured activation input; never scan serialized author scripts for lore triggers. */
  sourceContext?: unknown;
  choiceMode?: "attitude-only";
  /** Scene-GM's flexible Chinese prose target, not a validation quota/token limit. */
  pacing?: {suggestedWords: number};
  dialogue?: { turn: number; role: string; purpose: string; programState: unknown; taskGuide: string[]; selectedResponse: string | null; programDecisionPending?: boolean;
    /** v13: full, already-read dialogue, limited by the current actors' knowledge. */
    previousRead?: {sceneId: string; text: string; knownBy: string[]; evidenceIds: string[]}[];
    gmManaged?: true;
  };
};
export type LowText = { lines: { speaker: string; emotion: string; text: string }[]; choices: string[];
  phase?: { complete: boolean; reason: string };
  fidelity?: { mode: "canonical" | "model-extracted"; restored: boolean };
  formatWarnings?: string[];
};
export type LowFormatVersion = 1 | 2;
export type LowFrame = { version: 1; scene: LowScene; expressions: LowExpressions; messages: Message[]; sampling: LowSampling;
  readerVersion?: 2 | 3 | 4 | 5 | 6;
  materialHash: string; requestHash: string; sources: SourceDocument[]; briefs: { id: string; path: string; sha256: string; text: string }[];
  trace: { id: string; contentHash: string; indices: number[] }[]; formatInstruction: string };
export type LowAttempt = { id: string; stage: "writing" | "formatting"; at: number; endedAt: number | null; model: string; connectionHash: string;
  status: "running" | "succeeded" | "failed" | "interrupted"; output: string | null; usage: Usage; outcomeUnknown: boolean; requestHash: string;
  diagnostics?: import("../airp-generation/diagnostics").CallDiagnostics };
export type LowRequest = { stage: "writing" | "formatting"; messages: Message[]; sampling?: LowSampling; requestHash: string; acceptPartialDraft?: true };
