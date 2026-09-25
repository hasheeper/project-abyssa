import type { AirpHead } from "./airp";
import type { AirpForm, AirpPhase } from "./airp-pool";

/** New protocol. It deliberately does not widen the published pool/direct readers. */
export const DIRECTOR_PROTOCOL = 1 as const;
export const DIRECTOR_LIMITS = {
  dailyNew: 2, dailyFocus: 1, dailyLight: 1, offered: 2, activeSorties: 1,
  cooldownPhases: 256, actions: 4, choices: 3, actors: 4,
  definitionBytes: 96 * 1024, planBytes: 256 * 1024,
} as const;
export type DirectorChoice = { id: string; label: string; intent: string };
export type DirectorAction = {
  id: string; actorId: string; locationId: string; intent: string; choices: DirectorChoice[];
} & (
  | { kind: "talk" | "do" }
  | { kind: "patrol"; objectiveId: string }
  | { kind: "wait"; phases: number }
);
export type DirectorCard = {
  version: 1; id: string; title: string; tier: "ripple"; form: AirpForm;
  giverId: string; actorIds: string[]; locationId: string;
  themeKey: string; themeDescription: string; objectIds: string[];
  synopsis: string; motivation: string; load: "focus" | "light";
  volatility: "inert" | "consequential"; offerPhases: 4 | 8; repeat: "once" | "after-cooldown";
  choices: DirectorChoice[]; actions: DirectorAction[];
  scenes: { offer: string; acceptance: string; result: string; declined: string };
  aftermath: { intent: string; actorIds: string[] } | null;
};
export type DirectorFixedCard = {
  card: DirectorCard; authorStatus: "working-draft" | "approved";
  sourceId: string; sourceDigest: string;
};
export type DirectorContent = {
  version: 1; fixed: DirectorFixedCard[]; capabilities: DirectorCapabilities;
  authorSources: {id: string; body: unknown; digest: string}[];
  demoStart: {id: "start.airp.patrol"; routeId: string};
};
export type DirectorCapabilities = {
  actorIds: string[]; locationIds: string[]; objectIds: string[];
  locations: Record<string, Record<AirpPhase, string | null>>;
  /** Binding to authored, executable objectives; no model-authored routes or rewards. */
  objectives: Record<string, { routeId: string; roomDefinitionId: string; layer: number; roomIndex: number; objectIds: string[] }>;
};
export type DirectorTheme = {
  key: string; description: string; objectIds: string[]; sourceId: string;
  untilPhase: number | null;
};
/** Narrative residents do not grant combat availability. Frozen by an explicit configure fact. */
export type DirectorResidentCast = {version: 1; locations: DirectorCapabilities["locations"]};
export type DirectorWorld = {
  head: AirpHead; phase: number; eligible: boolean; availableActorIds: string[];
  occupiedActorIds: string[]; sourceIds: string[];
  existing: { id: string; load: "focus" | "light"; status: "offered" | "accepted" | "ready"; form: AirpForm }[];
  requiredStoryIds: string[]; busyFocus: boolean;
  themes: DirectorTheme[]; uniqueCompletedIds: string[];
  followups: { parentId: string; card: DirectorCard; eligible: boolean; consumed: boolean }[];
  reserves?: { eventId: string; card: DirectorCard; availableFromPhase: number }[];
};
export type DirectorEntryProposal = {
  id: string; fromPhase: number; throughPhase: number; basisIds: string[];
  source: { kind: "fixed"; definitionId: string } | { kind: "free"; card: DirectorCard } | { kind: "followup"; parentId: string } | {kind: "reserve"; eventId: string};
};
export type DirectorPlanProposal = {
  version: 1; day: number; reason: string;
  focus: { kind: "existing" | "story" | "new"; id: string } | null;
  entries: DirectorEntryProposal[];
};
export type DirectorThemeReview = {
  version: 1; planHash: string;
  decisions: { entryId: string; verdict: "new" | "same" | "uncertain"; matchedSourceIds: string[]; reason: string }[];
};
export type DirectorDayBudget = {
  day: number; publishedIds: string[]; focusIds: string[]; lightIds: string[];
};
export type DirectorAcceptedEntry = {
  id: string; origin: "fixed" | "free" | "followup" | "reserve"; parentId: string | null; card: DirectorCard;
  reserveId?: string;
  fromPhase: number; throughPhase: number; basisIds: string[];
};
export const emptyDirectorBudget = (day: number): DirectorDayBudget => ({day, publishedIds: [], focusIds: [], lightIds: []});

/** A scene is not an event. Repeated actual attempts get a new occurrence, HTTP retries do not. */
export type DirectorSceneRole = "offer" | "acceptance" | "action" | "feedback" | "result" | "declined" | "aftermath" | "followup";
export type DirectorStepProgress = {
  actionIndex: number; occurrence: number;
  status: "offered" | "accepted" | "waiting-action" | "feedback" | "ready" | "resolved" | "closed";
  selectedChoiceIds: string[]; evidenceIds: string[]; readSceneIds: string[];
};
