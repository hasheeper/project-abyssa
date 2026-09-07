import type {
  BattleState,
  BattleMode,
  ExpeditionResult,
  ItemInstance,
  EquipmentInstance,
  TraitInstance,
} from "../battle/domain/state";

export const EXPEDITION_FIELDS = [
  "location",
  "layer",
  "deepestLayer",
  "gold",
  "bagGold",
  "handMultiplier",
  "lastLayerSettlement",
  "enemySequence",
  "party",
  "rng",
  "statuses",
  "encounterRules",
  "loadoutAtStart",
  "loadout",
  "eventSequence",
  "log",
  "facts",
] as const;
export const ENCOUNTER_FIELDS = [
  "round",
  "layerStartEnemies",
  "lastTossed",
  "stalledRounds",
  "lastEnemyHp",
  "rerollsRemaining",
  "dice",
  "enemies",
  "pendingEffects",
  "pendingReactions",
] as const;
// Adding any execution field requires an explicit ownership decision here.
export const UNASSIGNED_EXECUTION_FIELDS: Record<
  Exclude<
    keyof BattleState,
    | (typeof EXPEDITION_FIELDS)[number]
    | (typeof ENCOUNTER_FIELDS)[number]
    | "mode"
    | "result"
    | "undoStack"
  >,
  never
> = {};

export type ExpeditionLifecycle =
  | { type: "in-encounter" }
  | { type: "exit-choice" }
  | { type: "finished"; result: ExpeditionResult };
export type EncounterTurn = Exclude<
  BattleMode,
  { type: "greed" } | { type: "finished" }
> | null;
export type ExpeditionMechanics = Pick<
  BattleState,
  (typeof EXPEDITION_FIELDS)[number]
> & { lifecycle: ExpeditionLifecycle };
export type EncounterMechanics = Pick<
  BattleState,
  (typeof ENCOUNTER_FIELDS)[number]
> & { turn: EncounterTurn };
export type RunCheckpoint = {
  action: string;
  expedition: ExpeditionMechanics;
  encounter: EncounterMechanics;
};
export type GameExpedition = ExpeditionMechanics & {
  id: string;
  routeId: string;
  undoStack: RunCheckpoint[];
};
export type GameEncounter = EncounterMechanics & {
  id: string;
  definitionId: string;
};

export type CampaignState = {
  clock: { day: number; phase: "dawn" | "day" | "dusk" | "night" };
  funds: { public: number; party: number; crystals: number };
  availableCharacterIds: string[];
  inventory: {
    capacity: number;
    items: ItemInstance[];
    equipment: EquipmentInstance[];
  };
  traits: TraitInstance[];
  activeExpeditionId: string | null;
  appliedSettlements: Array<{
    id: string;
    expeditionId: string;
    result: ExpeditionResult;
  }>;
};
export type GameSnapshot = {
  campaign: CampaignState;
  expedition: GameExpedition | null;
  encounter: GameEncounter | null;
};
