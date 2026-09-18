/** AIRP-1 contract revision, NOT a released Catalog or save schema version. */
export const AIRP_CONTRACT_VERSION = 1 as const;
export const AIRP_LIMITS = {
  actors: 5, tags: 8, sceneBytes: 16 * 1024, sceneCount: 128,
  narrativeBytes: 4 * 1024 * 1024, instances: 128, memories: 256,
  jobs: 128, attemptsPerJob: 3, contextBytes: 24 * 1024,
  instanceBytes: 4 * 1024, memoryBytes: 4 * 1024, jobBytes: 2 * 1024,
  metadataBytes: 128 * 1024, knowledgeEntries: 24, knowledgeText: 320,
} as const;

export type AirpHead = { saveId: string; epoch: string; revision: number };
export type AirpRef = { id: string; version: number };
export type AirpStance = "iron" | "seasoned" | "pragmatic";
export type AirpSceneRole = "offer" | "departure" | "found" | "return-extracted" | "return-cleared" | "retry" | "declined" | "expired";

/** Only the first sortie template is executable in AIRP-1. Other forms come in AIRP-3. */
export type AirpSortieDefinition = {
  contractVersion: 1; id: string; version: number; tier: "ripple"; form: "sortie";
  title: string; themeKey: string; tags: string[]; actorIds: string[];
  offerPhases: number; volatility: "inert" | "consequential";
  acceptedDeadline: null; cooldownPhases: 256;
  objective: {
    kind: "room-evidence-return"; routeId: string; roomDefinitionId: string;
    layer: number; roomIndex: number; evidenceId: string;
    successOutcomes: ["extracted", "cleared"]; onWipe: "retry";
  };
  reward: { kind: "memory-only"; memoryKey: string };
  scenes: Record<AirpSceneRole, string>;
};

export type AirpPatrolBinding = {
  instanceId: string; definition: AirpRef; contentDigest: string;
  acceptedHead: AirpHead; acceptedFactId: string;
  departureHead: AirpHead; departureFactId: string;
  runId: string; routeId: string; roomDefinitionId: string;
  roomInstanceId: string; evidenceId: string;
};

/** Projection produced ONLY by the validated journey/progression replay adapter, not client input. */
export type AirpObjectiveFact = {
  id: string; source: AirpHead; phase: number;
  origin: "adventure" | "memory"; runId: string; routeId: string;
} & (
  | { kind: "room-completed"; roomInstanceId: string; roomDefinitionId: string }
  | { kind: "expedition-settled"; terminalId: string; outcome: "extracted" | "cleared" | "wipe" }
);
export type AirpReturnProof = {
  instanceId: string; runId: string; evidenceId: string;
  sourceFactIds: [string, string, string, string];
  terminalId: string; outcome: "extracted" | "cleared";
};

type AirpInstanceBase = {
  id: string; definition: AirpRef; createdPhase: number; offerUntilPhase: number;
  offerSceneId: string; actorIds: string[];
};
type AirpAccepted = {
  exposedPhase: number; acceptedPhase: number; acceptedHead: AirpHead;
  acceptedFactId: string; stance: AirpStance;
};
export type AirpInstance = AirpInstanceBase & (
  | { status: "pending"; exposedPhase: null }
  | { status: "offered"; exposedPhase: number }
  | (AirpAccepted & { status: "accepted"; binding: AirpPatrolBinding | null })
  | (AirpAccepted & { status: "ready"; binding: AirpPatrolBinding; proof: AirpReturnProof; returnSceneId: string | null })
  | (AirpAccepted & { status: "resolved"; resolvedPhase: number; receiptId: string; returnSceneId: string; proof: AirpReturnProof })
  | { status: "closed"; exposedPhase: number | null; closedPhase: number; reason: "declined" | "expired-seen" | "reserved" | "missed"; aftermathId: string | null }
);

/** Enabled only by content 8's AIRP contract; legacy content rejects them. */
export type AirpPlayerCommand =
  | { type: "airp-open" | "airp-defer" | "airp-decline" | "airp-turn-in"; instanceId: string }
  | { type: "airp-read"; instanceId: string; sceneId: string; nodeId: string }
  | { type: "airp-accept"; instanceId: string; sceneId: string; nodeId: string; optionId: "A" | "B" | "C" };

/** Explicit knowledge grants, never inferred from the legacy visibility:'party' marker. */
export type AirpKnowledgeEntry = {
  id: string; axis: "agenda" | "bond"; phase: number; source: AirpHead;
  sourceFactIds: string[]; topicKeys: string[]; summary: string;
  knowledge: { kind: "public" } | { kind: "shared"; actorIds: string[] };
};
export type AirpContext = {
  contractVersion: 1; source: AirpHead;
  task: { instanceId: string; sceneId: string; role: "offer" | "return"; template: AirpRef };
  profiles: AirpRef[];
  agenda: AirpKnowledgeEntry[]; bond: AirpKnowledgeEntry[];
  locus: { phase: number; locationId: string; actorIds: string[] };
  omittedEntryCount: number; contextHash: string;
};
