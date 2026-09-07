/** Versioned demo content. Presentation assets and executable callbacks never enter a Catalog. */
import type { ManorContent } from "./manor-types";
export type DemoSuit = "earth" | "light" | "abyss" | "beyond";
export type DemoQuality = "plain" | "gild" | "rust";
export type DemoActionKind =
  | "attack"
  | "guard"
  | "heal"
  | "wild"
  | "blank"
  | "protect"
  | "expensive-heal"
  | "cleave-left"
  | "cleave-right"
  | "bind"
  | "guard-all"
  | "thread-strike";
export type DemoFace = {
  id: string;
  slot: number;
  name: string;
  pip: { kind: "natural"; value: number } | { kind: "wild" };
  fate: "awake" | "asleep";
  suit: DemoSuit;
  quality: DemoQuality;
  rust: "none" | "removable" | "permanent";
  actionId: string;
  power: number;
};
export type DemoCharacter = {
  id: string;
  name: string;
  maxHp: number;
  faction: "leader" | "hero" | "sovereign";
  suits: DemoSuit[];
  faces: DemoFace[];
  covenantId: string | null;
  /** Explicit non-executable capability; never an ignored effect reference. */
  release?: { kind: "dossier-only"; deferredCovenantId: string; reason: string };
};
export type DemoCovenant = {
  id: string;
  pattern: "flush" | "triple" | "straight" | "two-pair-blank";
  effect: "threat-damage" | "healing" | "execution-damage" | "knives";
  stages: [{ min: number; max: number }, { min: number; max: number }];
};
export type DemoGrowth = {
  id: string;
  ownerId: string;
  level: 2 | 3;
  awaken: number[];
  gild: number[];
};
export type DemoEquipmentDef = {
  id: string;
  slot: "general";
  replacement: "attack" | "heal";
  power: 1;
  scope: "all-native-blanks";
};
export type DemoContent = {
  characters: Record<string, DemoCharacter>;
  actions: Record<string, { id: string; kind: DemoActionKind }>;
  covenants: Record<string, DemoCovenant>;
  growth: Record<string, DemoGrowth>;
  equipment: Record<string, DemoEquipmentDef>;
  leaderId: string;
  initialParty: string[];
  maxPartySize: 5;
};
export type DemoEnemyDef = {
  id: string;
  hp: number;
  attack: number;
  bounty: number;
  behavior: "attack" | "charge" | "seal" | "idle" | "repair" | "butler" | "heiress";
  name?: string;
  artId?: string;
};
export type DemoEncounterDef = { id: string; enemyIds: string[] };
export type DemoRouteDef = { id: string; layers: string[][] };
export type DemoCatalog = DemoContent & {
  catalogId: string;
  contentVersion: number;
  rulesVersion: 2 | 3;
  manor?: ManorContent;
  enemies: Record<string, DemoEnemyDef>;
  encounters: Record<string, DemoEncounterDef>;
  routes: Record<string, DemoRouteDef>;
  journey?: DemoJourneyContent;
  profiles: Record<
    string,
    { id: string; progress: DemoProgress; availableCharacterIds: string[] }
  >;
};
export type DemoItemKind = "food" | "potion" | "ward" | "holy-water" | "maintenance-kit" | "lucky-charm" | "divination-slip";
export type DemoItemDef = { id: string; name: string; kind: DemoItemKind; capacity: number };
export type DemoRoomDef = { id: string; sceneId: string } & (
  | { kind: "battle"; encounterId: string }
  | { kind: "event"; eventId: string }
  | { kind: "exit"; canContinue: boolean }
);
export type DemoEventDef = { id: string; name: string; text: string; kind: "register" | "relic" | "seats"; cost: number; reward: number };
export type DemoJourneyContent = {
  rooms: Record<string, DemoRoomDef>;
  events: Record<string, DemoEventDef>;
  items: Record<string, DemoItemDef>;
  defaultItems: string[];
  defaultRouteId: string;
  defaultProfileId: string;
  depthPercent: number[];
  handBonusCapPercent: number;
};
export type DemoCatalogRef = {
  catalogId: string;
  contentVersion: number;
  rulesVersion: 2 | 3;
  digest: string;
};
export type ValidatedDemoCatalog = {
  readonly data: DemoCatalog;
  readonly ref: DemoCatalogRef;
};
export type DemoEquipment = {
  instanceId: string;
  definitionId: string;
  ownerId: string;
};
export type DemoProgress = {
  appliedGrowthIds: string[];
  equipment: DemoEquipment[];
};
export type DemoResolvedCharacter = {
  id: string;
  level: 1 | 2 | 3;
  maxHp: number;
  faction: DemoCharacter["faction"];
  suits: DemoSuit[];
  faces: DemoFace[];
  covenantId: string | null;
  covenantStage: 1 | 2;
  sources: string[];
};
