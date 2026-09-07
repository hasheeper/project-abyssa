import type {
  DemoCatalogRef,
  DemoProgress,
  DemoResolvedCharacter,
  DemoSuit,
} from "../../contracts/demo";
import type { BattleRngState, JsonValue, RngStreamState } from "./state";

export type DemoMember = {
  id: string;
  config: DemoResolvedCharacter;
  hp: number;
  temporaryRust: string[];
  pendingSeal: boolean;
  rainyReturn: boolean;
};
export type DemoDie = {
  ownerId: string;
  faceIndex: number | null;
  loaded: boolean;
  spent: boolean;
  sealed: boolean;
};
export type DemoIntent = {
  kind: "attack" | "charge" | "seal" | "idle" | "repair" | "summon";
  targetId: string | null;
  value: number;
  blocked: number;
  /** Only version 3 persists an intent identity and an optional live formula. */
  id?: string;
  formula?: { kind: "banquet-seats"; reduction: number };
  /** Accepted only by the explicit v4 reader. */
  operation?: "memory-reorder";
};
export type DemoEnemy = {
  id: string;
  definitionId: string;
  hp: number;
  chargeReady: boolean;
  threaded: boolean;
  escaped: boolean;
  boundRound: number | null;
  intent: DemoIntent | null;
  origin?: { kind: "initial" | "summoned"; serial: number; bornRound: number; summonerId: string | null; seat: boolean };
  disposition?: "active" | "defeated" | "released";
};
export type DemoHandDie = {
  ownerId: string;
  faceId: string;
  value: number;
  suit: DemoSuit;
  quality: "plain" | "gild" | "rust";
};
export type DemoHand = {
  name: string;
  bonus: number;
  qualityModifier: number;
  adjustedBonus: number;
  dice: DemoHandDie[];
  contributors: string[];
  wildValue: number | null;
  patterns: {
    flush: boolean;
    triple: boolean;
    straight: boolean;
    twoPair: boolean;
    fullHouse: boolean;
  };
  hasBlank: boolean;
  covenantOwnerIds: string[];
};
export type DemoEncounterState = {
  id: string;
  definitionId: string;
  round: number;
  phase: "roll" | "act" | "enemy" | "complete";
  outcome: "victory" | "wipe" | null;
  dice: DemoDie[];
  enemies: DemoEnemy[];
  formation: string[];
  enemyOrder: string[];
  cursor: number;
  hand: DemoHand | null;
  rerolls: number;
  guardBonusIds: string[];
  itemsUsed: number;
  extraRerolls: number;
  manor?: { summoned: number; released: boolean };
  /** V4 historical endurance ending; never a manor release flag. */
  memory?: { bossId: string; puppetId: string; defeated: boolean; released: boolean };
};
export type DemoSupply = { instanceId: string; definitionId: string; source: "supply.demo.allowance" | "supply.demo.shop"; charges: number };
export type DemoLayerResult = { layer: number; roomId: string; looseGold: number; handBonusPercent: number; depthPercent: number; earthPercent: number; gold: number };
export type DemoEventResult = { roomId: string; eventId: string; choiceId: "read" | "attempt" | "skip"; actorId: string | null; faceId: string | null; method: "read" | "skip" | "strong" | "weak" | "failed"; cost: number; reward: number };
export type DemoRunState<Ref = DemoCatalogRef, Supply = DemoSupply> = {
  id: string;
  routeId: string;
  contentRef: Ref;
  progress: DemoProgress;
  party: DemoMember[];
  layer: number;
  room: number;
  encounterSequence: number;
  looseGold: number;
  handBonus: number;
  bankedGold: number;
  completedEncounterIds: string[];
  settledLayers: number[];
  rng: BattleRngState;
  sequence: number;
  roomIds: string[][];
  completedRoomIds: string[];
  supplies: Supply[];
  foodUses: Record<string, number>;
  layerResults: DemoLayerResult[];
  eventResults: DemoEventResult[];
  revealed: string[];
  eventRng: RngStreamState;
};
export type DemoCheckpoint<Run = DemoRunState> = {
  run: Run;
  encounter: DemoEncounterState;
};
export type DemoBattleState<Run = DemoRunState> = DemoCheckpoint<Run> & { undo: DemoCheckpoint<Run>[] };
export type DemoEvent = {
  id: string;
  type: string;
  actorId: string | null;
  payload: JsonValue;
};
export type DemoActionChoice =
  "attack" | "guard" | "heal" | "bind" | "guard-all";
export type DemoBattleCommand =
  | { type: "roll" }
  | { type: "reroll" }
  | { type: "toggle-load"; actorId: string }
  | {
      type: "act";
      actorId: string;
      choice: DemoActionChoice;
      targetId: string | null;
    }
  | { type: "end-turn" }
  | { type: "resolve-next-enemy" }
  | { type: "next-round" }
  | { type: "undo" };
