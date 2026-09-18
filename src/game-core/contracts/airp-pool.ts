import type { AirpHead, AirpKnowledgeEntry, AirpPatrolBinding, AirpPlayerCommand, AirpRef, AirpReturnProof, AirpSortieDefinition, AirpStance } from "./airp";
import type { AirpFrozenScene, AirpReading, AirpScript } from "./airp-live";

export type AirpForm = "sortie" | "liaison" | "household" | "vignette";
export type AirpPhase = "dawn" | "day" | "dusk" | "night";
export type AirpPoolRole = AirpFrozenScene["role"] | "target" | "complete" | "aftermath" | "followup";
export type AirpCard = {
  id: string; version: 1; tier: "ripple"; title: string; themeKey: string; tags: string[];
  actorIds: string[]; giverId: string; offerPhases: number; volatility: "inert" | "consequential";
  cooldownPhases: 256; repeat: "once" | "after-cooldown";
  scenes: Partial<Record<AirpPoolRole | "offer-setback" | "offer-reserve", string>>;
  summary: string; aftermath: string | null;
  objective: { form: "sortie"; spec: AirpSortieDefinition; itemLabel: string }
    | { form: "liaison"; targetActorId: string }
    | { form: "household" | "vignette"; actionLabel: string };
};
export type AirpPoolContent = {
  version: 2; cards: AirpCard[]; scripts: Record<string, AirpScript>;
  availability: Record<string, Record<AirpPhase, string | null>>;
  locations: Record<string, string>;
  scheduler: { dailyOffers: number; maxOpen: number; maxPerForm: 1; formOrder: AirpForm[] };
};
export type AirpPoolInstance = {
  id: string; definition: AirpRef; createdPhase: number; offerUntilPhase: number;
  actorIds: string[]; status: "pending" | "offered" | "accepted" | "ready" | "resolved" | "closed";
  variant: "initial" | "setback" | "reserve"; exposedPhase: number | null;
  accepted: { head: AirpHead; factId: string; phase: number; stance: AirpStance } | null;
  binding: AirpPatrolBinding | null; carryFactId: string | null; proof: AirpReturnProof | null;
  completionFactIds: string[]; returnSceneId: string | null; targetSceneId: string | null;
  closedPhase: number | null; reason: "declined" | "expired-seen" | "reserved" | "missed" | null;
  resolvedPhase: number | null; receiptId: string | null; aftermathRead: boolean;
};
export type AirpPoolScene = Omit<AirpFrozenScene, "role"> & { role: AirpPoolRole };
export type AirpPoolState = {
  version: 2; instances: AirpPoolInstance[]; scenes: AirpPoolScene[]; reading: AirpReading | null;
  memories: AirpKnowledgeEntry[];
  cooldowns: { themeKey: string; sourceFactId: string; fromPhase: number; untilPhase: number }[];
  reserve: { definition: AirpRef; sourceInstanceId: string; eligiblePhase: number }[];
  daily: { day: number; offers: number }; nextForm: number; lastBoundaryId: string | null;
  capacityStopped: boolean;
};
export type AirpPoolCommand = AirpPlayerCommand
  | { type: "airp-visit"; instanceId: string; actorId: string; locationId: string }
  | { type: "airp-finish"; instanceId: string };
export type AirpIntent = { version: 1; command: AirpPlayerCommand } | { version: 2; command: AirpPoolCommand };
export type AirpNarrativeState = import("./airp-live").AirpLiveState | AirpPoolState;
