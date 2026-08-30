import type {
  CharacterId,
  EnemyTurnEvent,
  ExpeditionResult,
  HandEvaluation,
  LayerSettlement,
  RoundOutcome,
  Verb
} from "./state";
import type { BattleResource, EffectSourceRef, TargetRef } from "./targets";

export type BattleEventEnvelope<TType extends string, TPayload> = {
  id: string;
  type: TType;
  payload: TPayload;
  source: EffectSourceRef;
  causeId: string | null;
  batchId: string | null;
  sequence: number;
};

export type RolledDieResult = {
  ownerId: CharacterId;
  faceIndex: number | null;
  sealed: boolean;
};

export type BattleEventPayloadMap = {
  "dice-rolled": {
    roll: "initial" | "reroll";
    results: RolledDieResult[];
    rerollsRemaining: number;
  };
  "die-load-changed": {
    ownerId: CharacterId;
    dieIndex: number;
    loaded: boolean;
  };
  "action-declared": {
    actorId: CharacterId;
    verb: Verb;
    target: TargetRef;
  };
  "damage-applied": {
    target: TargetRef;
    raw: number;
    modified: number;
    applied: number;
    hpBefore: number;
    hpAfter: number;
    lethal: boolean;
  };
  "guard-applied": {
    actorId: CharacterId;
    protectedId: CharacterId;
    enemyId: string;
    amount: number;
    blockedBefore: number;
    blockedAfter: number;
    shieldBefore: number;
    shieldAfter: number;
  };
  "healing-applied": {
    actorId: CharacterId;
    targetId: CharacterId;
    requested: number;
    applied: number;
    hpBefore: number;
    hpAfter: number;
    cost: number;
  };
  "resource-changed": {
    resource: BattleResource;
    before: number;
    after: number;
    delta: number;
    reason:
      | "steal"
      | "bounty"
      | "healing-cost"
      | "enemy-effect"
      | "settlement"
      | "effect";
  };
  "item-consumed": {
    instanceId: string;
    definitionId: string;
    chargesBefore: number;
    chargesAfter: number;
    amount: number;
  };
  "equipment-durability-changed": {
    instanceId: string;
    definitionId: string;
    durabilityBefore: number;
    durabilityAfter: number;
    amount: number;
    broken: boolean;
  };
  "die-spent": { ownerId: CharacterId };
  "unit-defeated": {
    target: Extract<TargetRef, { kind: "enemy" }>;
    reason: "damage" | "enemy-effect" | "frenzy-recoil" | "fled" | "effect";
    reward: number;
  };
  "action-resolved": {
    actorId: CharacterId;
    verb: Verb;
    target: TargetRef;
  };
  "undo-applied": { action: string };
  "hand-evaluated": {
    hand: HandEvaluation;
    multiplierBefore: number;
    multiplierAfter: number;
  };
  "enemy-turn-prepared": {
    enemyOrder: string[];
  };
  "enemy-intent-resolved": EnemyTurnEvent;
  "round-resolved": {
    outcome: RoundOutcome;
    round: number;
  };
  "round-started": { round: number };
  "layer-cleared": {
    layer: number;
    settlement: LayerSettlement | null;
  };
  "layer-started": { layer: number; round: number };
  "expedition-finished": { result: ExpeditionResult };
  "effect-applied": {
    effectId: string;
    effectType: string;
    target: TargetRef | null;
  };
  "modifier-applied": {
    effectId: string;
    modifierId: string;
    operation: string;
    before: number;
    after: number;
  };
  "status-applied": {
    instanceId: string;
    definitionId: string;
    target: TargetRef;
    stacks: number;
  };
  "status-modified": {
    instanceId: string;
    stacks: number;
    durationRemaining: number | null;
  };
  "status-removed": {
    instanceId: string;
    definitionId: string;
    targetKey: string;
    reason: "effect" | "cleanse" | "expired";
  };
  "unit-downed": {
    targetId: CharacterId;
  };
  "unit-revived": {
    targetId: CharacterId;
    hp: number;
  };
  "unit-spawned": {
    enemyId: string;
  };
  "unit-despawned": {
    enemyId: string;
    reason: "effect" | "fled";
  };
  "stat-modified": {
    target: TargetRef;
    stat: string;
    before: number;
    after: number;
  };
  "die-modified": {
    ownerId: CharacterId;
    changed: string[];
  };
  "intent-modified": {
    enemyId: string;
    operation: string;
  };
  "encounter-rule-applied": {
    instanceId: string;
    definitionId: string;
  };
  "encounter-rule-removed": {
    instanceId: string;
    definitionId: string;
  };
  "resolution-budget-exceeded": {
    kind: "events" | "depth";
    limit: number;
  };
  "resolution-failed": {
    error: string;
    effectId: string | null;
  };
};

export type BattleEventType = keyof BattleEventPayloadMap;

export type BattleEvent = {
  [TType in BattleEventType]: BattleEventEnvelope<
    TType,
    BattleEventPayloadMap[TType]
  >;
}[BattleEventType];
