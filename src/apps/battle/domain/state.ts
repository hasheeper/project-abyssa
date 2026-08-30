export type Rng = () => number;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type RngStreamName = "combat" | "loot" | "flavor";

export type RngStreamState = {
  algorithm: "mulberry32";
  seed: number;
  cursor: number;
};

export type BattleRngState = Record<RngStreamName, RngStreamState>;

export type Verb = "attack" | "guard" | "heal" | "coin" | "wild" | "blank";
export type FaceQuality = "plain" | "rust" | "gild" | "none";

export type FaceDef = {
  verb: Verb;
  /** Combat value: damage, guard, healing, or coin tier. */
  power: number;
  /** Hand pip from 1–6. */
  pip: number;
  wildPip?: boolean;
  label: string;
  /** Data definition ids expanded by the action-effect registry. */
  effectDefinitionIds?: readonly string[];
  quality: FaceQuality;
};

export type CharacterId = "kael" | "eustice" | "elora" | "kororo" | "norma";

export type CharacterDef = {
  id: CharacterId;
  name: string;
  faces: readonly FaceDef[];
};

export type EnemyKind = "brute" | "charger" | "anomaly" | "trap" | "summoner";
export type EnemyArt = "sentinel" | "amalgam" | "choir";

export type EnemyIntent =
  | {
      type: "attack";
      targetId: CharacterId;
      value: number;
      title: string;
      description: string;
    }
  | { type: "charge"; title: string; description: string }
  | { type: "seal"; targetId: CharacterId; title: string; description: string }
  | { type: "countdown"; title: string; description: string }
  | { type: "summon"; title: string; description: string };

export type EnemyState = {
  id: string;
  kind: EnemyKind;
  name: string;
  art: EnemyArt;
  hp: number;
  maxHp: number;
  attack: number;
  chargeReady: boolean;
  countdown: number;
  intent: EnemyIntent | null;
  blocked: number;
};

export type DieState = {
  ownerId: CharacterId;
  faceIndex: number | null;
  sealed: boolean;
  loaded: boolean;
  spent: boolean;
};

export type PartyMemberState = {
  id: CharacterId;
  hp: number;
  shield: number;
  downed: boolean;
  rustLevel: number;
  sealedNext: boolean;
};

export type LogTone = "good" | "bad" | "gold" | "purple" | "system";

export type LogEntry = {
  round: number;
  layer: number;
  tone: LogTone;
  text: string;
};

export type Phase = "roll" | "act" | "enemy";
export type ExpeditionStatus = "active" | "greed" | "finished";
export type RoundOutcome = "continue" | "layer-cleared" | "wipe";

export type ExpeditionResult = {
  wiped: boolean;
  baseGold: number;
  multiplier: number;
  totalGold: number;
  deepestLayer: number;
  crystal: boolean;
};

export type LayerSettlement = {
  layer: number;
  round: number;
  baseGold: number;
  handFactor: number;
  layerFactor: number;
  payout: number;
  bagBefore: number;
  bagAfter: number;
  closingHandName: string | null;
  closingHandBonus: number;
};

export type BattleMode =
  | { type: "awaiting-roll" }
  | { type: "player-turn" }
  | {
      type: "enemy-turn";
      enemyOrder: string[];
      cursor: number;
      closingHand: HandEvaluation | null;
      outcome: RoundOutcome | null;
    }
  | { type: "greed" }
  | { type: "finished" };

export type PendingResolution = {
  id: string;
  definitionId: string;
  payload: JsonValue;
  causeId: string | null;
  depth: number;
};

export type EffectDurationScope =
  | "effect"
  | "action"
  | "round"
  | "next-round"
  | "layer"
  | "expedition";

export type EffectDuration = {
  scope: EffectDurationScope;
  remaining: number;
};

export type EffectInstance = {
  instanceId: string;
  definitionId: string;
  sourceId: string;
  targetKey: string;
  stacks: number;
  maxStacks: number;
  duration: EffectDuration | null;
  tags: string[];
  data: JsonValue;
};

export type StatusInstance = EffectInstance & {
  kind: "status";
};

export type EncounterRuleInstance = EffectInstance & {
  kind: "encounter-rule";
};

export type BattleContentInstanceBase = {
  instanceId: string;
  definitionId: string;
  sourceId: string;
  ownerId: CharacterId | null;
  tags: string[];
  data: JsonValue;
};

export type ItemInstance = BattleContentInstanceBase & {
  kind: "item";
  charges: number;
  maxCharges: number;
};

export type EquipmentInstance = BattleContentInstanceBase & {
  kind: "equipment";
  ownerId: CharacterId;
  slot: string;
  durability: number;
  maxDurability: number;
};

export type TraitInstance = BattleContentInstanceBase & {
  kind: "trait";
  ownerId: CharacterId;
};

export type BattleLoadoutSnapshot = {
  items: ItemInstance[];
  equipment: EquipmentInstance[];
  traits: TraitInstance[];
};

export type BattleLoadoutSettlement = {
  consumedItems: Array<{
    instanceId: string;
    definitionId: string;
    chargesSpent: number;
    chargesRemaining: number;
  }>;
  equipmentWear: Array<{
    instanceId: string;
    definitionId: string;
    durabilitySpent: number;
    durabilityRemaining: number;
    broken: boolean;
  }>;
};

export type BattleStartInput = {
  location?: string;
  loadout?: BattleLoadoutSnapshot;
};

export type BattleCompletionOutput = {
  result: ExpeditionResult | null;
  loadout: BattleLoadoutSettlement;
};

/** Complete serializable state checkpoint; undo history itself is intentionally excluded. */
export type BattleCheckpoint = {
  action: string;
  state: ExpeditionState extends infer TState
    ? TState extends ExpeditionState
      ? Omit<TState, "undoStack">
      : never
    : never;
};

type ExpeditionStateCore = {
  location: string;
  layer: number;
  deepestLayer: number;
  round: number;
  layerStartEnemies: number;
  lastTossed: CharacterId[];
  stalledRounds: number;
  lastEnemyHp: number;
  gold: number;
  bagGold: number;
  handMultiplier: number;
  lastLayerSettlement: LayerSettlement | null;
  rerollsRemaining: number;
  enemySequence: number;
  party: PartyMemberState[];
  dice: DieState[];
  enemies: EnemyState[];
  rng: BattleRngState;
  pendingEffects: PendingResolution[];
  pendingReactions: PendingResolution[];
  statuses: StatusInstance[];
  encounterRules: EncounterRuleInstance[];
  loadoutAtStart: BattleLoadoutSnapshot;
  loadout: BattleLoadoutSnapshot;
  eventSequence: number;
  undoStack: BattleCheckpoint[];
  log: LogEntry[];
  facts: string[];
};

type BattleLifecycleState =
  | {
      mode: Extract<BattleMode, { type: "awaiting-roll" }>;
      result: null;
    }
  | {
      mode: Extract<BattleMode, { type: "player-turn" }>;
      result: null;
    }
  | {
      mode: Extract<BattleMode, { type: "enemy-turn" }>;
      result: null;
    }
  | {
      mode: Extract<BattleMode, { type: "greed" }>;
      result: null;
    }
  | {
      mode: Extract<BattleMode, { type: "finished" }>;
      result: ExpeditionResult;
    };

/** Canonical serializable state. Lifecycle discriminants rule out invalid combinations. */
export type BattleState = ExpeditionStateCore & BattleLifecycleState;

/** Compatibility name retained for existing Battle UI and tests. */
export type ExpeditionState = BattleState;

export type ActionError =
  | "not-act-phase"
  | "die-not-loaded"
  | "die-spent"
  | "die-sealed"
  | "wrong-face"
  | "invalid-target"
  | "target-full-hp"
  | "no-attack-intent";

export type ActionResult = {
  state: ExpeditionState;
  error: ActionError | null;
};

export type IncomingDamage = { raw: number; final: number };
export type IntentThreat = "blocked" | "lethal" | "normal";

export type StallVerdict = {
  stalling: boolean;
  routed: boolean;
  weakened: boolean;
  harmless: boolean;
  couldFinish: boolean;
  grinding: boolean;
};

export type HandRank = {
  name: string;
  bonus: number;
  used: number[];
};

export type HandEvaluation = HandRank & {
  adjustedBonus: number;
  qualityModifier: number;
  pips: (number | "wild")[];
  contributors: CharacterId[];
};

export type EndTurnResult = {
  state: ExpeditionState;
  outcome: RoundOutcome;
  hand: HandEvaluation | null;
};

export type PreparedEnemyTurn = {
  state: ExpeditionState;
  enemyOrder: string[];
  hand: HandEvaluation | null;
};

export type EnemyTurnEventResult = "hit" | "blocked" | "miss" | "effect";

export type EnemyTurnEvent = {
  enemyId: string;
  enemyName: string;
  intentType: EnemyIntent["type"];
  intent: EnemyIntent;
  title: string;
  targetId?: CharacterId;
  result: EnemyTurnEventResult;
  damage: number;
  hpBefore: number | null;
  hpAfter: number | null;
  lethal: boolean;
};

export type EnemyTurnStep = {
  state: ExpeditionState;
  event: EnemyTurnEvent | null;
};

export type GreedSummary = {
  bagTotal: number;
  nextLayer: number;
  nextLayerMultiplier: number;
  downedCount: number;
  rustedFaceCount: number;
  woundedCount: number;
  crystalHint: boolean;
};
