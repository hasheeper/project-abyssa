import type {
  CharacterId,
  DieState,
  EffectDuration,
  EncounterRuleInstance,
  EnemyIntent,
  EnemyState,
  EnemyTurnEvent,
  ExpeditionState,
  ExpeditionResult,
  HandEvaluation,
  JsonValue,
  LayerSettlement,
  PartyMemberState,
  RoundOutcome,
  StatusInstance
} from "./state";
import type {
  BattleResource,
  EffectSourceRef,
  TargetRef
} from "./targets";
import type { BattleEvent } from "./events";

export type UnitTargetRef = Extract<
  TargetRef,
  { kind: "party-member" | "enemy" }
>;

export type AtomicEffectBase = {
  id: string;
  source: EffectSourceRef;
  causeId: string | null;
  batchId: string | null;
  tags: string[];
};

export type AtomicEffect =
  | (AtomicEffectBase & {
      type: "declare-action" | "complete-action";
      actorId: CharacterId;
      verb: import("./state").Verb;
      target: TargetRef;
    })
  | (AtomicEffectBase & {
      type: "append-log";
      tone: import("./state").LogTone;
      text: string;
    })
  | (AtomicEffectBase & {
      type: "append-fact";
      text: string;
    })
  | (AtomicEffectBase & {
      type: "damage";
      target: UnitTargetRef;
      amount: number;
      rawAmount?: number;
      defeat?: {
        reason: Extract<BattleEvent, { type: "unit-defeated" }>["payload"]["reason"];
        reward: number;
        deferLayerClear?: boolean;
      };
    })
  | (AtomicEffectBase & {
      type: "report-damage";
      payload: Extract<BattleEvent, { type: "damage-applied" }>["payload"];
    })
  | (AtomicEffectBase & {
      type: "heal";
      target: Extract<TargetRef, { kind: "party-member" }>;
      amount: number;
      cost?: number;
    })
  | (AtomicEffectBase & {
      type: "guard";
      actorId: CharacterId;
      protectedId: CharacterId;
      enemyId: string;
      amount: number;
    })
  | (AtomicEffectBase & {
      type: "complete-enemy-intent";
      event: EnemyTurnEvent;
    })
  | (AtomicEffectBase & {
      type: "prepare-enemy-turn";
      hand: HandEvaluation;
      multiplierBefore: number;
      multiplierAfter: number;
      enemyOrder: string[];
      closingHand: HandEvaluation | null;
    })
  | (AtomicEffectBase & {
      type: "commit-dice-roll";
      roll: "initial" | "reroll";
      results: Extract<BattleEvent, { type: "dice-rolled" }>["payload"]["results"];
      rerollsRemaining: number;
      autoLoadOwnerIds: CharacterId[];
    })
  | (AtomicEffectBase & {
      type: "revive";
      target: Extract<TargetRef, { kind: "party-member" }>;
      hp: number;
    })
  | (AtomicEffectBase & {
      type: "cleanse";
      target: TargetRef;
      definitionIds?: string[];
      statusTags?: string[];
    })
  | (AtomicEffectBase & {
      type: "apply-status";
      target: TargetRef;
      status: Omit<StatusInstance, "kind" | "targetKey">;
      refresh: "replace" | "refresh" | "stack" | "extend";
    })
  | (AtomicEffectBase & {
      type: "remove-status";
      instanceId: string;
      reason?: "effect" | "cleanse" | "expired";
    })
  | (AtomicEffectBase & {
      type: "modify-status";
      instanceId: string;
      stacksDelta?: number;
      durationDelta?: number;
    })
  | (AtomicEffectBase & {
      type: "modify-stat";
      target: UnitTargetRef;
      stat: "hp" | "max-hp" | "attack" | "shield";
      operation: "add" | "set";
      value: number;
    })
  | (AtomicEffectBase & {
      type: "modify-die";
      ownerId: CharacterId;
      patch: Partial<Pick<DieState, "faceIndex" | "sealed" | "loaded" | "spent">>;
    })
  | (AtomicEffectBase & {
      type: "set-die-load";
      dieIndex: number;
      ownerId: CharacterId;
      loaded: boolean;
    })
  | (AtomicEffectBase & {
      type: "modify-party-member";
      targetId: CharacterId;
      patch: Partial<Pick<PartyMemberState, "sealedNext" | "rustLevel">>;
    })
  | (AtomicEffectBase & {
      type: "modify-enemy";
      enemyId: string;
      patch: Partial<
        Pick<
          EnemyState,
          | "chargeReady"
          | "countdown"
          | "blocked"
        >
      >;
      defeat?: {
        reason: Extract<BattleEvent, { type: "unit-defeated" }>["payload"]["reason"];
        reward: number;
      };
    })
  | (AtomicEffectBase & {
      type: "modify-battle-metrics";
      patch: Partial<Pick<ExpeditionState, "stalledRounds" | "lastEnemyHp">>;
    })
  | (AtomicEffectBase & {
      type: "set-round";
      round: number;
    })
  | (AtomicEffectBase & {
      type: "start-player-round";
      dice: DieState[];
      rerollsRemaining: number;
    })
  | (AtomicEffectBase & {
      type: "record-layer-settlement";
      settlement: LayerSettlement;
    })
  | (AtomicEffectBase & {
      type: "enter-greed";
    })
  | (AtomicEffectBase & {
      type: "finish-expedition";
      result: ExpeditionResult;
      announce: boolean;
    })
  | (AtomicEffectBase & {
      type: "finalize-round";
      outcome: RoundOutcome;
      settlement: LayerSettlement | null;
    })
  | (AtomicEffectBase & {
      type: "start-layer";
      layer: number;
      deepestLayer: number;
      enemies: EnemyState[];
      enemySequence: number;
    })
  | (AtomicEffectBase & {
      type: "announce-layer-started";
      layer: number;
      round: number;
    })
  | (AtomicEffectBase & {
      type: "modify-intent";
      enemyId: string;
      operation: "replace" | "cancel" | "add-block" | "retarget";
      intent?: EnemyIntent;
      amount?: number;
      targetId?: CharacterId;
    })
  | (AtomicEffectBase & {
      type: "spawn-unit";
      unit: EnemyState;
      enemySequence?: number;
    })
  | (AtomicEffectBase & {
      type: "despawn-unit";
      enemyId: string;
      reason: "effect" | "fled";
    })
  | (AtomicEffectBase & {
      type: "flee-unit";
      enemyId: string;
    })
  | (AtomicEffectBase & {
      type: "modify-resource";
      resource: BattleResource;
      operation: "add" | "set";
      value: number;
      reason?: Extract<BattleEvent, { type: "resource-changed" }>["payload"]["reason"];
    })
  | (AtomicEffectBase & {
      type: "modify-reward";
      operation: "add-gold" | "multiply-hand";
      value: number;
    })
  | (AtomicEffectBase & {
      type: "consume-item";
      instanceId: string;
      amount: number;
    })
  | (AtomicEffectBase & {
      type: "consume-equipment-durability";
      instanceId: string;
      amount: number;
    })
  | (AtomicEffectBase & {
      type: "apply-encounter-rule";
      rule: Omit<EncounterRuleInstance, "kind">;
    })
  | (AtomicEffectBase & {
      type: "remove-encounter-rule";
      instanceId: string;
    });

export type NumericModifierOperation =
  | "add"
  | "multiply"
  | "reduce"
  | "prevent"
  | "pierce"
  | "redirect";

export type EffectModifier = {
  instanceId: string;
  definitionId: string;
  sourceId: string;
  priority: number;
  window: "before-damage" | "before-heal";
  operation: NumericModifierOperation;
  value: number;
  requiredTags: string[];
  targetKinds: UnitTargetRef["kind"][];
  redirectTarget?: UnitTargetRef;
};

export type ModifierApplication = {
  instanceId: string;
  operation: NumericModifierOperation;
  before: number;
  after: number;
};

export type ReactionBinding = {
  instanceId: string;
  definitionId: string;
  sourceId: string;
  priority: number;
  eventTypes: BattleEvent["type"][];
  data: JsonValue;
};

export type EffectModifierTemplate = Omit<
  EffectModifier,
  "instanceId" | "definitionId" | "sourceId"
>;

export type ReactionBindingTemplate = Omit<
  ReactionBinding,
  "instanceId" | "definitionId" | "sourceId"
>;

export type BattleEffectDefinition = {
  definitionId: string;
  modifiers: readonly EffectModifierTemplate[];
  reactions: readonly ReactionBindingTemplate[];
};

export type BattleEffectDefinitionRegistry = Readonly<
  Record<string, BattleEffectDefinition>
>;

export type ActionEffectDefinition = {
  definitionId: string;
  trigger: "heal";
  effect: {
    type: "resource-cost";
    resource: BattleResource;
    amount: number;
    reason: Extract<BattleEvent, { type: "resource-changed" }>["payload"]["reason"];
    log: string;
    fact: string | null;
  };
};

export type ActionEffectDefinitionRegistry = Readonly<
  Record<string, ActionEffectDefinition>
>;

export type ReactionContext = {
  state: Readonly<ExpeditionState>;
  event: BattleEvent;
  binding: ReactionBinding;
};

export type ReactionHandler = (context: ReactionContext) => AtomicEffect[];
export type ReactionRegistry = Readonly<Record<string, ReactionHandler>>;

export type EffectResolutionOptions = {
  modifiers?: readonly EffectModifier[];
  reactions?: readonly ReactionBinding[];
  reactionRegistry?: ReactionRegistry;
  effectDefinitions?: BattleEffectDefinitionRegistry;
  maxEvents?: number;
  maxDepth?: number;
};

export type EffectResolutionError =
  | "event-budget-exceeded"
  | "trigger-depth-exceeded"
  | "invalid-effect-target"
  | "missing-reaction-handler";

export type EffectResolution = {
  state: ExpeditionState;
  events: BattleEvent[];
  error: EffectResolutionError | null;
};

export type StatusApplication = {
  definitionId: string;
  stacks: number;
  maxStacks: number;
  duration: EffectDuration | null;
  tags: string[];
  data: JsonValue;
};
