import type { OpeningProgress, OpeningAdvance } from "./opening-progress";
import type { D5CatalogRef, ValidatedD5Catalog } from "../contracts/d5";
import type { DemoProgress } from "../contracts/demo";
import type { DemoBattleState, DemoCheckpoint, DemoSupply } from "../battle/domain/demo-state";
import type { DemoExpeditionState, DemoTerminal } from "./demo-expedition";
import type { ManorProgression } from "./manor-progression";
import type { TutorialProgress, TutorialRunState } from "./tutorial-types";

export type D5RunRef = { kind: "expedition"; id: string } | { kind: "memory"; id: string; attempt: number };
export const GAME_START_POINTS = ["prologue", "first-morning", "tutorial", "hub", "debug-shop", "airp-demo", "airp-director"] as const;
export type GameStartPoint = typeof GAME_START_POINTS[number];
export type D5UserChoiceTone = "iron" | "seasoned" | "pragmatic";
export type D5StoryAdvanceChoice = "continue" | "skip" | "later" | D5UserChoiceTone;
export type ShopIntroductionProgress = {step: number; status: "pending" | "viewed" | "skipped" | "exempt"};
export type ShopIntroductionAdvance = {type: "shop-introduction-advanced"; shopId: string; step: number; choice: "continue" | "skip"};
export type D5Checkpoint = Omit<DemoCheckpoint, "run"> & {
  run: Omit<DemoCheckpoint["run"], "contentRef"> & { contentRef: D5CatalogRef };
};
export type D5BattleState = D5Checkpoint & { undo: D5Checkpoint[] };
export type D5MemorySupply = Omit<DemoSupply, "source"> & { source: "memory.marietta.allowance" };
export type D5MemoryCheckpoint = Omit<D5Checkpoint, "run"> & {
  run: Omit<D5Checkpoint["run"], "supplies"> & { supplies: D5MemorySupply[] };
};
export type D5MemoryBattleState = D5MemoryCheckpoint & { undo: D5MemoryCheckpoint[] };
export type D5BaseExpeditionState = DemoExpeditionState<D5BattleState["run"]>;
export type D5ExpeditionState = D5BaseExpeditionState & { tutorial?: TutorialRunState<D5BaseExpeditionState> };
export type D5MemoryTerminal = {
  id: string;
  runRef: Extract<D5RunRef, { kind: "memory" }>;
  chapterId: string;
  templateId: string;
  finalBattle: D5MemoryBattleState;
};

/** Semantic evidence produced by accepted application transitions; never a player command. */
export type D5ProgressEvent =
  | {type: "shop-visit-operated"; command: import("../contracts/shop-visit").ShopVisitCommand}
  | {type: "facility-operated"; command: import("../contracts/facilities").FacilityCommand}
  | OpeningAdvance
  | ShopIntroductionAdvance
  | { type: "phase-advanced" }
  | { type: "game-start-selected"; startAt: GameStartPoint; playerName?: string }
  | { type: "prologue-advanced"; shotId: string }
  | { type: "prologue-completed"; shotId: string; choice: "continue" | "skip" }
  | { type: "loot-sold"; shopId: string; instanceId: string; quoteVersion: number; quantity?: number }
  | { type: "loot-appraised"; shopId: string; instanceId: string; quoteVersion: number }
  | ({ type: "product-purchased" } & import("../contracts/shop").ProductPurchase)
  | { type: "supply-purchased"; shopId: string; definitionId: string; quantity: number; quoteVersion: number }
  | { type: "memory-inherited"; runId: string; chapterId: string }
  | { type: "expedition-started"; runId: string; routeId: string; partyIds: string[]; itemIds: string[]; supplyQuantities?: Record<string, number>; progress: DemoProgress }
  | { type: "expedition-settled"; terminal: DemoTerminal; finalRun: D5ExpeditionState }
  | { type: "manor-story"; terminalId: string; step: number; choice: "continue" | "skip" }
  | { type: "memory-started"; runId: string; chapterId: string; templateId: string; seed: number }
  | { type: "memory-advanced"; runRef: Extract<D5RunRef, { kind: "memory" }>; node: "history-opening" | "teaching" | "battle" | "return-pending" }
  | { type: "memory-read"; runRef: Extract<D5RunRef, { kind: "memory" }>; node: "present-intro" | "history-opening" | "teaching" | "history-complete"; step: number; choice?: D5UserChoiceTone }
  | { type: "memory-ended"; terminal: D5MemoryTerminal }
  | { type: "memory-retried"; runId: string; previousAttempt: number }
  | { type: "memory-left"; runRef: Extract<D5RunRef, { kind: "memory" }> }
  | { type: "story-started"; sessionId: string; eventId: string; basisId: string }
  | { type: "story-advanced"; sessionId: string; step: number; choice: D5StoryAdvanceChoice }
  | { type: "story-completed"; sessionId: string }
  | { type: "equipment-moved"; instanceId: string; fromOwnerId: string | null; toOwnerId: string | null; targetFaceId?: string };

export type D5ProgressEntry = {
  id: string;
  revision: number;
  origin: "adventure" | "memory" | "present";
  event: D5ProgressEvent;
};
export type D5EquipmentInstance = {
  instanceId: string;
  definitionId: string;
  grantId: string;
  targetFaceId?: string;
  location: { kind: "inventory" } | { kind: "equipped"; ownerId: string } | { kind: "reserved"; ownerId: string; runId: string };
};
export type D5StorySession = {
  id: string; eventId: string; basisId: string; step: number; lastStep: number; deferred: boolean;
  choices?: { step: number; tone: D5UserChoiceTone }[];
};
export type D5MemorySession = {
  id: string; chapterId: string; templateId: string; seed: number; attempt: number; step: number;
  choices?: { node: "present-intro" | "history-opening" | "teaching" | "history-complete"; step: number; tone: D5UserChoiceTone }[];
  node: "present-intro" | "history-opening" | "teaching" | "battle" | "failed" | "history-complete" | "return-pending" | "left" | "completed";
};
export type D5Projection = {
  shopVisit?: import("../contracts/shop-visit").ShopVisitProgress;
  facilities?: import("./facility-types").FacilityState | null;
  /** Explicit demo access, derived only from the start fact; never a first-clear or reward. */
  airpDemoStart?: {id: "start.airp.patrol"; claimId: string; routeId: string};
  /** Absent on historical saves; assigned with the fresh save's start selection. */
  playerName?: string;
  /** Immutable receipt for the assets granted by a skipped tutorial. */
  startReward?: {id: string; rewardId: string; gold: number; supplies: DemoSupply[]; loot: import("../contracts/loot").OwnedLoot[]};
  tutorial?: TutorialProgress;
  opening?: OpeningProgress;
  shopIntroduction?: ShopIntroductionProgress;
  shop?: import("../contracts/shop").ShopState | null;
  prologue?: { shotId: string; status: "playing" | "viewed" | "skipped" };
  inheritedChapter?: {completionId: string; terminalId: string};
  clock: { day: number; phase: "dawn" | "day" | "dusk" | "night" };
  funds: { public: number; party: number; crystals: number };
  supplies: DemoSupply[];
  settlements: DemoTerminal[];
  manor: ManorProgression;
  progress: DemoProgress;
  inventory: D5EquipmentInstance[];
  /** Content 13 only. Assets and immutable trade records are reconstructed from facts. */
  loot?: import("../contracts/loot").OwnedLoot[];
  lootTrades?: import("../contracts/loot").LootTrade[];
  availableCharacterIds: string[];
  activeRunRef: D5RunRef | null;
  memory: D5MemorySession | null;
  stories: D5StorySession[];
  activeStoryId: string | null;
  chapterCompletion: { id: string; terminalId: string; revision: number } | null;
  chapterClaim: { id: string; completionId: string; revision: number } | null;
  growthGrants: { id: string; growthId: string; basisId: string; revision: number }[];
  giftGrantId: string | null;
  teamMilestone: { growthId: "growth.kael.team-lv3-guard"; sourceGrantId: string } | null;
};
export type D5RunSnapshot =
  | { kind: "expedition"; id: string; state: D5ExpeditionState }
  | { kind: "memory"; id: string; attempt: number; battle: D5MemoryBattleState | null };
export type D5Snapshot = { campaign: D5Projection; run: D5RunSnapshot | null };

/** Validated origin projection. Instance IDs remain save-scoped; no strings are guessed or rewritten. */
export type D5Baseline = D5Snapshot & {
  /** Derived from a validated readonly ancestor, not decoded as an optional save field. */
  narrative?: import("../contracts").AirpNarrativeState;
  departures: {revision: number; event: Extract<D5ProgressEvent, {type:"expedition-started"}>; supplyIds: string[]}[];
  anchors: string[];
};

/** Trusted core capabilities, supplied by code at assembly time, never decoded from an archive.
 * B fails closed for battle bodies until C installs the actual rule readers. */
export type D5RunReaders = {
  baseline?: D5Baseline;
  resolveOrigin?: (raw: unknown, catalog: ValidatedD5Catalog) => D5Baseline;
  /** Production readers require deterministic ordinary journey provenance as well. */
  requireJourneyHistory?: boolean;
  expedition?: (catalog: ValidatedD5Catalog, raw: unknown) => D5ExpeditionState;
  memory?: (catalog: ValidatedD5Catalog, raw: unknown) => D5MemoryBattleState;
};
// Retain the relation to the shared pure combat state without copying another engine.
export type D5SharedEncounter = DemoBattleState["encounter"];
