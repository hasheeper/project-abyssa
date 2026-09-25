import type { AirpKnowledgeEntry, AirpReturnProof, AirpStance } from "../../game-core/contracts";
import type { HeadRef } from "../contracts";
import type { Models, Preset, Resources, Usage } from "../airp-generation/contracts";

export const DIRECT_STAGES = ["planning", "writing", "formatting", "updater"] as const;
export type DirectStage = typeof DIRECT_STAGES[number];
export type DirectMaterial = {version: 1 | 2; resources: Resources; preset: Preset; orderId: string; models: Models};
export type NarrativeFlags = {careOffered: boolean; routeCautionMentioned: boolean};
export type UpdateProposal = {summary: string; supports: string[]; flags: {key: keyof NarrativeFlags; value: true; supports: string[]}[]};
export type DirectMemory = UpdateProposal & {
  id: string; sceneId: string; instanceId: string; bodyHash: string; source: HeadRef;
  phase: number; actorIds: ["kael", "elora"]; readFactIds: string[]; committedFactId: string;
};
export type DirectContext = {
  sourceKind: "gameplay"; version: 1; head: HeadRef; contentDigest: string;
  sceneId: string; instanceId: string; task: "return" | "followup"; playerName: string;
  phase: number; location: "mansion.common-room"; actorIds: ["kael", "elora"];
  stance: AirpStance; proof: AirpReturnProof;
  facts: {id: string; text: string; knownBy: ["kael", "elora"]}[];
  gameMemories: AirpKnowledgeEntry[];
  memories: DirectMemory[]; flags: NarrativeFlags;
  parent: {sceneId: string; bodyHash: string; prose: string; memoryId: string} | null;
};
export type DirectAttempt = {
  id: string; stage: DirectStage; ordinal: number; inputHash: string; startedAt: number; endedAt: number | null;
  status: "running" | "succeeded" | "failed" | "interrupted"; output: string | null; usage: Usage;
  error: "provider-error" | "cancelled" | "interrupted" | "invalid-output" | null; outcomeUnknown: boolean;
};
export type DirectTask = {
  id: string; sceneId: string; instanceId: string; task: "return" | "followup";
  source: "undecided" | "requested" | "browser-direct" | "handwritten";
  context: DirectContext | null; materialHash: string | null; attempts: DirectAttempt[];
  bodyHash: string | null;
  read: {head: HeadRef; phase: number; factIds: string[]; bodyHash: string} | null;
  memoryId: string | null;
};
export type AirpDirectState = {
  version: 1; materials: Record<string, DirectMaterial>; tasks: DirectTask[];
  memories: DirectMemory[]; flags: Record<string, NarrativeFlags>;
};
export type AirpDirectCommand =
  | {type: "airp-direct-prepare"; sceneId: string; materialHash: string; material?: DirectMaterial}
  | {type: "airp-direct-begin"; sceneId: string; attemptId: string; stage: DirectStage; at: number}
  | {type: "airp-direct-result"; sceneId: string; attemptId: string; at: number; output: string; usage: Usage}
  | {type: "airp-direct-fail"; sceneId: string; attemptId: string; at: number; error: "provider-error" | "cancelled" | "interrupted"; outcomeUnknown: boolean; usage: Usage}
  | {type: "airp-direct-handwritten"; sceneId: string}
  | {type: "airp-direct-followup"; instanceId: string};
export type AirpDirectIntent = {version: 1; command: AirpDirectCommand};
export const emptyAirpDirect = (): AirpDirectState => ({version: 1, materials: {}, tasks: [], memories: [], flags: {}});
export const emptyNarrativeFlags = (): NarrativeFlags => ({careOffered: false, routeCautionMentioned: false});
export const DIRECT_LIMITS = {tasks: 2, memories: 8, summaryChars: 320, materials: 2, stateBytes: 2 * 1024 * 1024, commandBytes: 2 * 1024 * 1024, attempts: 24};
