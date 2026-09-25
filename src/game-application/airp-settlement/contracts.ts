import type { SettlementBatch, SettlementEffect, SettlementInput, SettlementItemRef, SettlementMemory, SettlementPolicy, SettlementReceipt, SettlementState, SettlementThread } from "../../game-core/contracts";
import type { HeadRef } from "../contracts";
import type { Message, Usage } from "../airp-generation/contracts";

export const SETTLEMENT_RUNTIME_VERSION = 1 as const;
export const SETTLEMENT_CAPACITY = { bytes: 8 * 1024 * 1024, inputBytes: 2 * 1024 * 1024, jobs: 96, frames: 8, attempts: 12 } as const;
/** Exact text selected by the program. No literary preset or credentials in this contract. */
export type SettlementMaterials = {
  memoryView?: import("../airp-memory/contracts").MemoryView;
  cards: { actorId: string; text: string; digest: string }[];
  evidence: { sourceId: string; text: string; digest: string }[];
  world: { id: string; text: string; digest: string; triggerIds: string[] }[];
  /** Checkpoint purpose / already tracked tasks, not additional narrative evidence. */
  checkpoint?: { kind: "scene" | "action" | "event" | "run"; trackedTasks: { eventId: string; title: string; status: string }[] };
};
export type SettlementFrame = {
  input: SettlementInput; materials: SettlementMaterials;
  promptVersion: string; instruction: string; requestHash: string;
  /** Frozen with the request; old saved frames retain their original schema. */
  outputSchema?: unknown;
};
export type SettlementAttempt = {
  id: string; frame: number; model: string; connectionHash: string;
  startedAt: number; endedAt: number | null;
  status: "running" | "succeeded" | "failed" | "interrupted";
  output: string | null; usage: Usage; outcomeUnknown: boolean;
  error: "provider-error" | "invalid-output" | "interrupted" | "cancelled" | "stale-result" | null;
};
export type SettlementJob = {
  id: string; mode: "mechanical" | "model" | "program-only";
  frames: SettlementFrame[]; attempts: SettlementAttempt[];
  status: "pending" | "running" | "ready" | "failed" | "stale" | "applied";
  prepared: SettlementBatch | null;
  /** Explicit offline revalidation of a saved failed output; original attempts remain unchanged. */
  revalidatedAttemptId?: string;
  /** Explicitly waived narrative assessment; full originals/attempts remain available. */
  fallback?: { reason: "player-facts-only"; head: HeadRef };
  problem: "invalid-output" | "provider-error" | "interrupted" | "cancelled" | "stale-result" | "asset-pending" | null;
};
export type SettlementLedger = {
  version: 1; policy: SettlementPolicy; state: SettlementState;
  memories: SettlementMemory[]; openThreads: SettlementThread[];
  receipts: SettlementReceipt[]; jobs: SettlementJob[];
};
export type SettlementHostSnapshot = {
  memoryView?: import("../airp-memory/contracts").MemoryView;
  /** Root aggregate CAS head, including bookkeeping commits. */
  head: HeadRef;
  /** Last real gameplay/settlement change; bookkeeping alone must NOT invalidate model input. */
  worldHead: HeadRef;
  ledger: SettlementLedger;
  appliedItemOperations: SettlementItemRef[];
};
export type SettlementHostCommit = {
  expectedHead: HeadRef; expectedWorldHead: HeadRef;
  kind: "metadata" | "settlement";
  next: SettlementLedger; effects: SettlementEffect[];
};
/** Implemented against the ONE owning aggregate. Never a second wallet or fire-and-forget sidecar. */
export interface SettlementHostPort {
  read(): Promise<SettlementHostSnapshot>;
  /** Atomic root CAS + assets + ledger + memory + receipt. Rejection must leave all unchanged. */
  commit(command: SettlementHostCommit): Promise<SettlementHostSnapshot>;
}
export type SettlementModelRequest = { taskId: string; frame: number; requestHash: string; messages: Message[] };
export type SettlementResultCommand = {
  jobId: string; attemptId: string; output: string; usage: Usage; at: number;
};
export type SettlementCompletionPort = (request: SettlementModelRequest) => Promise<{ text: string; usage: Usage }>;

export class SettlementRuntimeError extends Error {
  constructor(public readonly code: "conflict" | "invalid-state" | "stale-result" | "asset-pending" | "pending-dependency" | "capacity", message: string) {
    super(message); this.name = "SettlementRuntimeError";
  }
}
