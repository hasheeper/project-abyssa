import type { ExpeditionPlanNode, SettlementGrant } from "../../game-core/contracts";
import type { HeadRef } from "../contracts";
import type { ExpeditionJob } from "../airp-expedition-gm/contracts";
import type { SettlementLedger } from "../airp-settlement/contracts";
import type { LowAttempt, LowFormatVersion, LowFrame, LowMaterial, LowText } from "../airp-low/contracts";

export type NodeSource = { id: string; head: HeadRef; phase: number; runId: string; text: string; knownBy: string[] };
/** Trusted program projection; never assembled from an LLM response. No hidden drop/identity fields. */
export type NodeProgram = {
  runId: string; routeId: string; phase: number; position: number; slotIds: string[]; actorIds: string[];
  terminal: "cleared" | "extracted" | "wipe" | null; sources: NodeSource[];
  objectiveProgress: { eventId: string; objectiveId: string; conditionMet: boolean; evidenceId: string | null; returned: boolean; delivery: string; noAdditionalReward: true }[];
  actions: (NodeSource & { slotId: string; actionId: string })[];
  start: { factId: string; commandHash: string; beforeHead: HeadRef };
  events: { id: string; status: "offered" | "accepted" | "closed" }[];
};
export type NodeJob = {
  id: string; planId: string; proposalHash: string; node: ExpeditionPlanNode;
  status: "waiting" | "open" | "skipped" | "completed";
  frame: LowFrame | null; frozenWorld: HeadRef | null; triggerSources: NodeSource[];
  attempts: LowAttempt[]; text: LowText | null; reads: HeadRef[];
  /** Explicit entry into the reader, even before the first paragraph is acknowledged. */
  shown?: true;
  /** Explicit player authorizations, never credentials or rewritten old attempts. */
  connectionChanges?: { stage: "writing" | "formatting"; afterAttemptId: string; connectionHash: string }[];
  /** Explicit offline read of an unchanged failed response; not a successful model attempt. */
  writingRevalidation?: { attemptId: string; readerVersion: 3 | 5 };
  /** Explicitly adopted postprocessor for an unfinished historical scene. Frozen requests stay intact. */
  postprocessVersion?: 5;
  formatVersion?: LowFormatVersion;
  formattingRevalidation?: { attemptId: string; formatVersion: LowFormatVersion };
  writingWarnings: string[];
  selected: { index: number; text: string; head: HeadRef } | null;
  settlementId: string | null; skipReason: "passed" | "terminal" | "player" | null;
};
export type NodeLedger = { version: 1; jobs: NodeJob[] };
export type NodeSnapshot = { head: HeadRef; worldHead: HeadRef; plan: ExpeditionJob; program: NodeProgram; ledger: NodeLedger;
  memoryView?: import("../airp-memory/contracts").MemoryView;
  material: LowMaterial; settlement: SettlementLedger; grants: Record<string, SettlementGrant[]> };
export type NodeCommit = { expectedHead: HeadRef; expectedWorldHead: HeadRef; next: NodeLedger; kind: "metadata" | "observation" };
export interface NodeHostPort { read(): Promise<NodeSnapshot>; commit(command: NodeCommit): Promise<NodeSnapshot> }
export const NODE_CAPACITY = { jobs: 48, attempts: 12, bytes: 12 * 1024 * 1024 } as const;
