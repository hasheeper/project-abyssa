import type { AirpHead } from "./airp";

/** Standalone CL-A protocol. NOT a Catalog/content/save version or a migration. */
export const AIRP_SETTLEMENT_PROTOCOL = 1 as const;
/** Safety capacities, not prompt word counts or approved game balancing. */
export const AIRP_SETTLEMENT_LIMITS = { changes: 32, sources: 512, points: 32, text: 4000, proposalBytes: 128 * 1024 } as const;

export type SettlementPolicy = {
  id: string;
  actorIds: string[];
  observerIds: string[];
  locationIds: string[];
  endConditionIds: string[];
  affinity: {
    initial: number; min: number; max: number; eventAbsLimit: number;
    grades: { id: string; delta: number }[];
  };
  activities: { id: string; busy: boolean; maxPhases: number }[];
  conditions: { id: string; maxPhases: number }[];
};

/** A phase deadline is mandatory even for condition-ended states: no permanent busy. */
export type SettlementTimedState = { id: string; untilPhase: number; endConditionId: string | null };
export type SettlementActorState = {
  actorId: string; locationId: string | null;
  activity: SettlementTimedState | null; conditions: SettlementTimedState[];
};
/** Only the new cross-variable slice. Campaign, inventory, quests and plans remain elsewhere. */
export type SettlementState = {
  protocol: 1; policyId: string; head: AirpHead; phase: number;
  affinity: { actorId: string; value: number }[];
  actors: SettlementActorState[];
};
export type SettlementScope = {
  kind: "action" | "event" | "run";
  boundaryId: string;
  eventId: string | null; actionId: string | null; runId: string | null;
};
export type SettlementArchiveRef = { sceneId: string; paragraphId: string; digest: string };
/** Program-projected facts/read cursors, NEVER taken from the model's claimed sources. */
export type SettlementEvidence = {
  id: string; head: AirpHead; phase: number;
  eventId: string | null; actionId: string | null; runId: string | null;
  role: "current" | "history";
  authority: "fact" | "claim"; speakerId: string | null; knownBy: string[];
} & (
  | { kind: "program-fact"; factId: string }
  | { kind: "read-paragraph"; archive: SettlementArchiveRef; readAtRevision: number }
);

/** Opaque, frozen operation owned by the asset domain; no second inventory/price schema. */
export type SettlementItemRef = { adapterId: string; operationId: string; operationHash: string };
export type SettlementActorField = "location" | "activity" | "conditions";
/** Created by the program, not the GM/model. IDs survive feedback and event-summary tasks. */
export type SettlementGrant =
  | { id: string; kind: "affinity"; actorId: string; eventId: string; accountId: string }
  | { id: string; kind: "item"; operation: SettlementItemRef }
  | { id: string; kind: "actor"; actorId: string; changeId: string; fields: SettlementActorField[] };

export type SettlementPoint = {
  kind: "fact" | "claim"; text: string; speakerId: string | null;
  knownBy: string[]; basisIds: string[];
};
/** Program-normalized scene record, not a verified world fact or one person's entire speech.
 * Keep the summary and ALL references intact; attribute each unverified claim to its source.
 * The model output contract remains fact/claim. Only admission creates records.
 */
export type SettlementMemoryPoint = SettlementPoint | {
  kind: "record"; text: string; speakerId: null; knownBy: string[]; basisIds: string[];
  claims: { sourceId: string; speakerId: string }[];
};
export type SettlementThreadUntil = "run-end" | "event-end" | "resolved";
export type SettlementThread = SettlementMemoryPoint & { id: string; scope: SettlementScope;
  /** Explicit only for new threads; legacy records are never assigned an inferred lifetime. */
  until?: SettlementThreadUntil; topicKey?: string;
};
export type SettlementActorProposal = {
  grantId: string; basisIds: string[];
  locationId?: string;
  activity?: SettlementTimedState | null;
  conditions?: { add: SettlementTimedState[]; removeIds: string[] };
};
export type SettlementProposal = {
  protocol: 1; taskId: string; inputHash: string;
  affinity: { grantId: string; gradeId: string; reason: string; basisIds: string[] }[];
  items: { grantId: string; basisIds: string[] }[];
  actors: SettlementActorProposal[];
  memory: {
    points: SettlementPoint[];
    open: (SettlementPoint & { key: string; until?: SettlementThreadUntil })[];
    close: { id: string; basisIds: string[] }[];
    priorReceiptIds: string[];
  };
};

export type SettlementEffect = { id: string; basisIds: string[] } & (
  | { kind: "affinity"; actorId: string; eventId: string; accountId: string;
      gradeId: string; requestedDelta: number; delta: number; before: number; after: number; reason: string }
  | { kind: "item"; operation: SettlementItemRef }
  | { kind: "actor"; actorId: string; changeId: string; before: SettlementActorState; after: SettlementActorState }
);
export type SettlementMemory = {
  id: string; phase: number; scope: SettlementScope;
  points: SettlementMemoryPoint[]; opened: SettlementThread[]; closed: { id: string; basisIds: string[] }[];
  /** Numeric/asset truth comes from effects/asset receipts, never from free-text summaries. */
  effectIds: string[]; priorReceiptIds: string[];
  /** References only: complete read originals remain in their unchanged archive. */
  sources: SettlementEvidence[];
};
/** Issued ONLY after the application transaction and all item-domain checks succeed. */
export type SettlementReceipt = {
  id: string; taskId: string; inputHash: string; committedHead: AirpHead;
  effects: SettlementEffect[]; memoryId: string;
};
/** A frozen program projection. Full cards/archive bytes are resolved separately, not summarized here. */
export type SettlementInput = {
  state: SettlementState; policy: SettlementPolicy; scope: SettlementScope;
  evidence: SettlementEvidence[]; grants: SettlementGrant[];
  fullActorCards: { actorId: string; digest: string }[]; openThreads: SettlementThread[];
  priorReceipts: SettlementReceipt[];
  /** Movement/combat/occupancy facts take precedence over narrative suggestions. */
  actorLocks: { actorId: string; fields: SettlementActorField[] }[];
  /** Program-confirmed scope endings, not model wishes. Only explicit-lifetime threads auto-expire. */
  lifecycle?: { kind: "run" | "event"; id: string; basisIds: string[] }[];
};
export type SettlementCommitGate = {
  head: AirpHead;
  /** Entire applied ledger for this save/epoch, including asset-domain operation receipts. */
  receipts: SettlementReceipt[];
  appliedItemOperations: SettlementItemRef[];
};
export type SettlementBatch = {
  protocol: 1; taskId: string; inputHash: string; expectedHead: AirpHead; policyId: string;
  effects: SettlementEffect[]; memory: SettlementMemory;
};
export type SettlementPreparation =
  | { status: "prepared"; batch: SettlementBatch }
  | { status: "already-applied"; receipt: SettlementReceipt };

/** CL-B persistence boundary: failure is pending work, never a successful empty settlement. */
export type SettlementWorkState =
  | { status: "pending"; taskId: string; inputHash: string;
      reason: "not-started" | "model-failed" | "validation-failed" | "asset-pending" }
  | { status: "prepared"; batch: SettlementBatch; saveFailure: string | null }
  | { status: "applied"; receipt: SettlementReceipt };
