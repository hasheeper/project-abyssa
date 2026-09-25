import type { DirectorAcceptedEntry, DirectorCard, DirectorCapabilities, DirectorChoice, DirectorDayBudget, DirectorFixedCard, DirectorPlanProposal, DirectorSceneRole, DirectorThemeReview, DirectorWorld } from "../../game-core/contracts";
import type { HeadRef } from "../contracts";
import type { CompiledInput, Usage } from "../airp-generation/contracts";
import type { DirectMaterial } from "../airp-direct-gameplay/contracts";
import type { LowFormatVersion, LowFrame, LowMaterial } from "../airp-low/contracts";

export type DirectorSource = {id: string; phase: number; text: string; knownBy: string[]; evidenceIds: string[]};
/** GM-only, immutable checkpoint projection. Never passed to the prose/formatter. */
export type GMContext = {
  memoryContext?: import("../airp-memory/contracts").MemoryContext;
  version: 1; sourceHead: HeadRef; knowledge: "gm-only-not-common-npc-knowledge";
  playerName: string; world: DirectorWorld; capabilities: DirectorCapabilities; budget: DirectorDayBudget;
  activity: {clock: {day: number; phase: "dawn" | "day" | "dusk" | "night"}; activeStoryId: string | null;
    activeRun: {id: string; routeId: string; node: string; layer: number; roomIndex: number; partyIds: string[]} | null};
  actorPresence: {actorId: string; locationId: string | null; basis: "active-expedition" | "effective-state-or-program-schedule"}[];
  tasks: DirectorEvent[];
  dayPlans: {day: number; jobId: string; sourceHead: HeadRef; entryIds: string[]; replaces: string[]; proposal: DirectorPlanProposal; proposalHash: string}[];
  facts: DirectorSource[]; memories: DirectorSource[]; openThreads: DirectorSource[];
  settlement: Pick<import("../../game-core/contracts").SettlementState, "actors" | "affinity"> | null;
  previousRead: {sceneId: string; text: string; knownBy: string[]; evidenceIds: string[]; readCount: number; complete: boolean}[];
  expedition: import("../airp-game/gm-share-contracts").GMShare | null;
  /** References resolve ONLY against this job's saved material, not today's files. */
  documents: {id: string; sha256: string}[];
};
export type DirectorLowContextVersion = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21;
export type CoveredAcceptance = {choiceId: string; basisSceneIds: string[]; reason: string};
export type SceneGMPlan = {pacing: "brief" | "develop"; suggestedWords: number; focus: string; alreadyCovered: string[]; stopWhen: string; reason: string};
export type SceneGMEvaluation = {complete: boolean; reason: string; unresolved: string[]; /** v16: the same call guides the next turn. */ next?: SceneGMPlan | null;
  /** v18: display authoritative task guidance, never rewrite prose or mutate facts. */ taskGuideConflict?: boolean;
  /** v20: conditional narrative coverage, applied only after reading and an actual matching choice. */
  coveredAcceptance?: CoveredAcceptance[]; coverageWarnings?: string[]};
export type DirectorPlanningContext = {
  version: 1; sourceKind: "gameplay"; playerName: string; world: DirectorWorld;
  capabilities: DirectorCapabilities; fixed: DirectorFixedCard[];
  authorSources: {id: string; text: string; digest: string}[];
  tasks: Pick<DirectorEvent, "id" | "card" | "status" | "role" | "actionIndex" | "occurrence" | "selected" | "deferredUntil" | "actionPhase" | "actionOutcome" | "evidenceIds" | "readSceneIds">[];
  facts: DirectorSource[]; memories: DirectorSource[]; budget: DirectorDayBudget;
};
export type DirectorSceneContext = {
  version: 1; sourceKind: "gameplay"; head: HeadRef; phase: number; playerName: string;
  eventId: string; sceneId: string; role: DirectorSceneRole; actorIds: string[]; locationId: string;
  card: DirectorCard; actionIndex: number; occurrence: number; intent: string;
  choices: DirectorChoice[]; selected: {id: string; label: string; intent: string; sourceId: string}[];
  selectedAttitudes?: DirectorSource[];
  dialogue?: NonNullable<import("../airp-low/contracts").LowScene["dialogue"]>;
  /** v15: only the preceding read turn of this stage, not a world-state fact. */
  previousEvaluation?: (SceneGMEvaluation & {sceneId: string}) | null;
  facts: DirectorSource[]; memories: DirectorSource[];
  previous: {sceneId: string; text: string; knownBy: string[]; evidenceIds: string[]}[];
  taskReports: {sceneId: string; text: string; fromActorIds: string[]; toActorIds: string[]; via: "player-task-relay"; evidenceIds: string[]}[];
  authorSource: {text: string; digest: string} | null;
  /** v3: current program truth, separate from authored prose and model memories. */
  progress?: {
    status: DirectorEvent["status"]; actionIndex: number; actionCount: number;
    actionKind: DirectorCard["actions"][number]["kind"] | null;
    actionOutcome: DirectorEvent["actionOutcome"];
    delivery: NonNullable<DirectorEvent["delivery"]> | null;
    runResult: { runId: string; outcome: string; deepestLayer: number; partyIds?: string[] } | null;
    readScenes: { sceneId: string; role: DirectorSceneRole; actionIndex: number }[];
    evidenceIds: string[];
  };
  settlement?: Pick<import("../../game-core/contracts").SettlementState, "actors" | "affinity">;
  settlementRead?: import("../airp-settlement/share").SettlementShare["read"];
};
export type DirectorStage = "director" | "review" | "planning" | "writing" | "formatting" | "memory" | "scene-plan" | "scene-evaluate";
export type DirectorAttempt = {
  id: string; stage: DirectorStage; ordinal: number; inputHash: string;
  formatRepair?: 1;
  directorRepair?: 1;
  at: number; endedAt: number | null; status: "running" | "succeeded" | "failed";
  output: string | null; usage: Usage; outcomeUnknown: boolean;
  error: "invalid-output" | "provider-error" | "cancelled" | "interrupted" | null;
  diagnostics?: import("../airp-generation/diagnostics").CallDiagnostics;
};
export type DirectorSceneText = {creationRecord: string; lines: {speaker: string; emotion: string; text: string}[]};
export type DirectorJob = {
  memoryCorrections?: import("../airp-memory/contracts").MemoryCorrection[];
  id: string; kind: "day" | "scene" | "memory"; materialHash: string;
  replaces?: string[];
  planning: DirectorPlanningContext | null; scene: DirectorSceneContext | null;
  /** v17: independent GM knowledge; never merged into scene/Low. */
  gmContext?: GMContext;
  attempts: DirectorAttempt[]; proposal: DirectorPlanProposal | null; review: DirectorThemeReview | null;
  acceptedEntries: DirectorAcceptedEntry[] | null; text: DirectorSceneText | null;
  excerpt?: {sourceSceneId: string; quotes: {line: number; text: string}[]};
  lowFrame?: LowFrame;
  lowWarnings?: string[];
  lowChoices?: string[];
  lowResponse?: { index: number; text: string; sourceId: string };
  lowPhase?: { complete: boolean; reason: string };
  lowFidelity?: NonNullable<import("../airp-low/contracts").LowText["fidelity"]>;
  lowReadVersion?: 2 | 3 | 4 | 5 | 6;
  lowRevalidatedWriting?: string;
  lowFormatVersion?: LowFormatVersion;
  /** Offline adoption of a saved failed formatter response; original attempt stays unchanged. */
  lowRevalidatedFormatting?: string;
  lowContextVersion?: DirectorLowContextVersion;
  sceneGMPlan?: SceneGMPlan;
  sceneGMEvaluation?: SceneGMEvaluation;
  connections?: { stage: "writing" | "formatting" | "scene-plan" | "scene-evaluate"; afterAttemptId: string; config: import("../airp-generation/contracts").ModelConfiguration }[];
};
export type DirectorMaterial = DirectMaterial;
export const DIRECTOR_RUNTIME_LIMITS = {
  materials: 4, events: 96, scenes: 192, dayJobs: 96, attemptsPerJob: 12,
  stateBytes: 3 * 1024 * 1024, commandBytes: 2 * 1024 * 1024,
} as const;
export type DirectorPreparedInput = CompiledInput & {stage: DirectorStage};
export type DirectorJobCommand =
  | {type: "airp-director-use-format"; jobId: string; formatVersion: LowFormatVersion}
  | {type: "airp-director-begin"; jobId: string; attemptId: string; stage: DirectorStage; at: number; formatRepair?: 1; directorRepair?: 1}
  | {type: "airp-director-result"; jobId: string; attemptId: string; output: string; usage: Usage; at: number; diagnostics?: import("../airp-generation/diagnostics").CallDiagnostics}
  | {type: "airp-director-fail"; jobId: string; attemptId: string; error: "provider-error" | "cancelled" | "interrupted"; outcomeUnknown: boolean; usage: Usage; at: number; diagnostics?: import("../airp-generation/diagnostics").CallDiagnostics};

export type DirectorEvent = DirectorAcceptedEntry & {
  status: "planned" | "offered" | "accepted" | "waiting-action" | "feedback" | "ready" | "resolved" | "closed" | "reserve" | "cancelled";
  publishedPhase: number | null; expiresPhase: number | null; endedPhase: number | null;
  exposed: boolean; deferredUntil: number; role: DirectorSceneRole; actionIndex: number; occurrence: number;
  dialogueTurn?: number;
  selected: DirectorSceneContext["selected"]; evidenceIds: string[]; readSceneIds: string[];
  actionPhase: number | null; actionOutcome: "succeeded" | "failed" | null;
  binding: {runId: string; roomId: string; startFactId: string; rewardDefinitionId?: string} | null;
  closeReason: "declined" | "expired" | "missed" | null; followupConsumed: boolean;
  /** Return/handover proof; v1 physical rewards also bind the exact owned instance. */
  delivery?: { itemInstanceId?: string; runId: string; returnFactId: string; status: "pending" | "confirmed"; confirmedFactId: string | null };
  /** A skipped narrative is not a fabricated read scene or an executed game action. */
  narrativeSkips?: (CoveredAcceptance & {role: "acceptance"; sourceJobId: string; decisionFactId: string; phase: number})[];
};
export type DirectorState = {
  residentCast?: import("../../game-core/contracts").DirectorResidentCast;
  version: 1; materialHash: string | null; materials: Record<string, DirectorMaterial>;
  /** Explicit replayable upgrade: accepting a single-path patrol registers it independently of reading. */
  commissionVersion?: 1;
  /** Physical quest inventory, rebuilt from return facts and atomic delivery commands. */
  questItems?: {item: import("../../game-core/contracts").CommissionItem; status: "owned" | "delivered"; receivedFactId: string; deliveredFactId: string | null}[];
  jobs: DirectorJob[]; events: DirectorEvent[]; budgets: DirectorDayBudget[];
  days: {day: number; jobId: string; entryIds: string[]}[];
  memories: DirectorSource[];
  cursors: Record<string, number>;
  reading: {eventId: string; jobId: string; cursor: number; paused: boolean; completed?: boolean} | null;
  lowMaterial?: LowMaterial;
  lowReadVersion?: 2 | 3 | 4 | 5 | 6;
  lowContextVersion?: DirectorLowContextVersion;
};
export type DirectorCommand = DirectorJobCommand
  | {type: "airp-director-enable-commissions"}
  | {type: "airp-director-configure"; material: DirectorMaterial; lowMaterial?: LowMaterial; lowReadVersion?: 2 | 3 | 4 | 5 | 6; lowContextVersion?: DirectorLowContextVersion; residentCast?: import("../../game-core/contracts").DirectorResidentCast}
  | {type: "airp-director-respond"; jobId: string; index: number}
  | {type: "airp-director-revalidate-low"; jobId: string; readerVersion: 2 | 3 | 4 | 5}
  | {type: "airp-director-prepare-day"}
  | {type: "airp-director-prepare-replan"}
  | {type: "airp-director-reconnect"; jobId: string; config: import("../airp-generation/contracts").ModelConfiguration}
  | {type: "airp-director-accept-day"; jobId: string}
  | {type: "airp-director-open"; eventId: string}
  | {type: "airp-director-pause"}
  | {type: "airp-director-show"; jobId: string}
  | {type: "airp-director-prepare-memory"; jobId: string}
  | {type: "airp-director-read"; jobId: string; cursor: number}
  | {type: "airp-director-choose"; eventId: string; choiceId: string}
  | {type: "airp-director-deliver"; eventId: string}
  | {type: "airp-director-defer" | "airp-director-decline"; eventId: string};
export type DirectorIntent = {version: 1; command: DirectorCommand; gmShare?: import("../airp-game/gm-share-contracts").GMShare};
export const emptyDirectorState = (): DirectorState => ({version: 1, materialHash: null, materials: {}, jobs: [], events: [], budgets: [], days: [], memories: [], cursors: {}, reading: null});
