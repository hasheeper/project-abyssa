import type { SettlementMemoryPoint, SettlementScope, SettlementThread } from "../../game-core/contracts";
import type { HeadRef } from "../contracts";

export type MemoryTarget = { id: string; kind: "summary" | "thread"; hash: string; phase: number; scope: SettlementScope; value: SettlementMemoryPoint | SettlementThread };
export type MemoryEvidence = { id: string; knownBy: string[]; head: HeadRef; pendingSceneId?: string; text?: string; speakerId?: string };
export type MemoryChange = { kind: "replace-summary" | "merge-summary" | "close-thread"; targetId: string; expectedHash: string; text?: string; duplicateOf?: { targetId: string; expectedHash: string } };
export type MemoryCorrection = {
  id: string; jobId: string; attemptId: string; sourceHead: HeadRef; recordedHead: HeadRef;
  reason: string; basisIds: string[]; changes: MemoryChange[]; before: MemoryTarget[];
  claims: {sourceId: string; speakerId: string}[];
  waitForSceneId: string | null; error: string | null;
};
export type MemoryView = {
  version: 1; targets: MemoryTarget[];
  closed: { target: MemoryTarget; correctionId: string; reason: string; effectiveHead: HeadRef }[];
  diagnostics: { id: string; status: "applied" | "pending" | "rejected"; reason: string; effectiveHead: HeadRef | null }[];
};
export type MemoryContext = MemoryView & { sourceHead: HeadRef; evidence: MemoryEvidence[] };
