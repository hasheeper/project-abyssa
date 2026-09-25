import type { AcceptedExpeditionPlan, ExpeditionPlanInput, SettlementActorState, SettlementMemory, SettlementReceipt, SettlementThread } from "../../game-core/contracts";
import type { D5Departure } from "../../game-core/session";
import type { HeadRef } from "../contracts";
import type { Message, Usage } from "../airp-generation/contracts";

export type ExpeditionSource = { id: string; kind: "program" | "read" | "settlement" | "author"; phase: number; knownBy: string[]; evidenceIds: string[]; text: string; digest: string };
export type ExpeditionDocument = { id: string; kind: "player" | "character" | "world" | "author"; text: string; digest: string; triggerIds: string[] };
export type ExpeditionContext = {
  gmContext?: import("../airp-director/contracts").GMContext;
  rules: ExpeditionPlanInput; playerName: string; requiredActorIds: string[];
  actors: SettlementActorState[]; affinity: { actorId: string; value: number }[];
  tasks: { id: string; status: string; stepId: string | null; selected: { id: string; intent: string; sourceId: string }[]; evidenceIds: string[] }[];
  sources: ExpeditionSource[]; memories: SettlementMemory[]; openThreads: SettlementThread[]; receipts: SettlementReceipt[];
  pendingSettlementIds: string[];
};
export type ExpeditionFrame = {
  version: 1; context: ExpeditionContext; documents: ExpeditionDocument[];
  /** Internal startup command; only its public fields and hash go to the model, never seed/RNG. */
  departure: D5Departure; inputHash: string; requestHash: string;
  instruction: string; reviewInstruction: string; outputSchema: unknown; promptVersion: string;
};
export type ExpeditionAttempt = {
  id: string; frame: number; stage: "plan" | "review"; model: string; connectionHash: string;
  at: number; endedAt: number | null; output: string | null; usage: Usage;
  status: "running" | "succeeded" | "failed" | "interrupted"; outcomeUnknown: boolean;
};
export type ExpeditionJob = {
  memoryCorrections?: import("../airp-memory/contracts").MemoryCorrection[];
  id: string; frames: ExpeditionFrame[]; attempts: ExpeditionAttempt[];
  status: "pending" | "running" | "review" | "ready" | "failed" | "stale" | "accepted" | "cancelled" | "started";
  prepared: AcceptedExpeditionPlan | null; problem: string | null;
  acceptedAt: HeadRef | null; startFactId: string | null;
  departureTicket: { expectedHead: HeadRef; proposalHash: string; commandHash: string } | null;
};
export type ExpeditionGMLedger = { version: 1; jobs: ExpeditionJob[] };
export type ExpeditionGMSnapshot = {
  head: HeadRef; context: ExpeditionContext; documents: ExpeditionDocument[]; departure: D5Departure;
  ledger: ExpeditionGMLedger; activeRunId: string | null;
  startProofs: { runId: string; commandHash: string; factId: string; beforeHead: HeadRef }[];
  /** Read-only projection of the asset module's frozen definitions, NOT inventory. */
  itemDefinitions: AcceptedExpeditionPlan["itemDefinitions"];
};
export type ExpeditionGMCommit = {
  expectedHead: HeadRef; next: ExpeditionGMLedger;
  change: { kind: "accept"; plan: AcceptedExpeditionPlan } | { kind: "release"; plan: AcceptedExpeditionPlan } | null;
};
export interface ExpeditionGMHostPort {
  read(options?: {refresh: true}): Promise<ExpeditionGMSnapshot>;
  /** One owning root CAS: plan and shared day/theme/asset-definition reservations, no gameplay effects. */
  commit(command: ExpeditionGMCommit): Promise<ExpeditionGMSnapshot>;
}
export type ExpeditionRequest = { taskId: string; frame: number; stage: "plan" | "review"; requestHash: string; messages: Message[] };
export class ExpeditionGMError extends Error {
  constructor(public code: "invalid" | "stale" | "conflict" | "pending" | "capacity" | "adapter-pending", message: string) { super(message); this.name = "ExpeditionGMError"; }
}
export const EXPEDITION_RUNTIME_CAPACITY = { bytes: 8 * 1024 * 1024, jobs: 48, frames: 4, attempts: 12 } as const;
