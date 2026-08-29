import { MAX_HP } from "../content/balance";
import type {
  AtomicEffect,
  EffectResolution,
  EffectResolutionError,
  EffectResolutionOptions,
  UnitTargetRef
} from "../domain/effects";
import type {
  BattleEvent,
  BattleEventPayloadMap,
  BattleEventType
} from "../domain/events";
import type {
  ExpeditionState,
  StatusInstance
} from "../domain/state";
import type { EffectSourceRef, TargetRef } from "../domain/targets";
import { cloneBattleState } from "../persistence/clone";
import { isEnemyDefeated } from "../selectors/battle-selectors";
import { getRustableFaceCapacity } from "./dice";
import { mergeEffectResolutionOptions } from "./effect-runtime";
import { applyNumericModifiers } from "./modifiers";
import { collectEventReactions } from "./reactions";

export const DEFAULT_EFFECT_EVENT_BUDGET = 256;
export const DEFAULT_EFFECT_DEPTH_LIMIT = 8;

type QueuedEffect = {
  effect: AtomicEffect;
  depth: number;
};

type ResolverEmitter = {
  events: BattleEvent[];
  emit<TType extends BattleEventType>(
    type: TType,
    payload: BattleEventPayloadMap[TType],
    source: EffectSourceRef,
    causeId: string | null,
    batchId: string | null
  ): Extract<BattleEvent, { type: TType }> | null;
  failBudget(kind: "events" | "depth", limit: number, source: EffectSourceRef): void;
};

export function targetRefKey(target: TargetRef): string {
  switch (target.kind) {
    case "party-member":
    case "enemy":
      return `${target.kind}:${target.id}`;
    case "die":
      return `die:${target.ownerId}`;
    case "intent":
      return `intent:${target.enemyId}`;
    case "resource":
      return `resource:${target.resource}`;
    case "battle":
      return "battle";
  }
  const exhaustive: never = target;
  return exhaustive;
}

function effectTarget(effect: AtomicEffect): TargetRef | null {
  switch (effect.type) {
    case "declare-action":
    case "complete-action":
      return effect.target;
    case "complete-enemy-intent":
      return { kind: "enemy", id: effect.event.enemyId };
    case "prepare-enemy-turn":
    case "modify-battle-metrics":
    case "set-round":
    case "start-player-round":
    case "record-layer-settlement":
    case "enter-greed":
    case "finish-expedition":
    case "finalize-round":
    case "start-layer":
    case "announce-layer-started":
      return { kind: "battle" };
    case "commit-dice-roll":
      return { kind: "battle" };
    case "append-log":
    case "append-fact":
      return { kind: "battle" };
    case "damage":
    case "heal":
    case "guard":
    case "revive":
    case "cleanse":
    case "apply-status":
    case "modify-stat":
      return effect.type === "guard"
        ? { kind: "intent", enemyId: effect.enemyId }
        : effect.target;
    case "report-damage":
      return effect.payload.target;
    case "modify-die":
      return { kind: "die", ownerId: effect.ownerId };
    case "set-die-load":
      return { kind: "die", ownerId: effect.ownerId };
    case "modify-party-member":
      return { kind: "party-member", id: effect.targetId };
    case "modify-enemy":
      return { kind: "enemy", id: effect.enemyId };
    case "modify-intent":
      return { kind: "intent", enemyId: effect.enemyId };
    case "spawn-unit":
      return { kind: "enemy", id: effect.unit.id };
    case "despawn-unit":
      return { kind: "enemy", id: effect.enemyId };
    case "flee-unit":
      return { kind: "enemy", id: effect.enemyId };
    case "modify-resource":
      return { kind: "resource", resource: effect.resource };
    case "modify-reward":
    case "consume-item":
    case "consume-equipment-durability":
    case "apply-encounter-rule":
    case "remove-encounter-rule":
      return { kind: "battle" };
    case "remove-status":
    case "modify-status":
      return null;
  }
  const exhaustive: never = effect;
  return exhaustive;
}

function createEmitter(state: ExpeditionState, maxEvents: number): ResolverEmitter {
  const events: BattleEvent[] = [];
  const startSequence = state.eventSequence;
  let budgetFailed = false;

  const forceBudgetEvent = (
    kind: "events" | "depth",
    limit: number,
    source: EffectSourceRef
  ) => {
    if (budgetFailed || events.length >= maxEvents) return;
    budgetFailed = true;
    const sequence = events.length;
    events.push({
      id: `event:${startSequence + sequence}`,
      type: "resolution-budget-exceeded",
      payload: { kind, limit },
      source,
      causeId: null,
      batchId: null,
      sequence
    });
  };

  return {
    events,
    emit(type, payload, source, causeId, batchId) {
      /* Reserve the final slot for an explicit budget error. */
      if (events.length >= Math.max(0, maxEvents - 1)) {
        forceBudgetEvent("events", maxEvents, source);
        return null;
      }
      const sequence = events.length;
      const event = {
        id: `event:${startSequence + sequence}`,
        type,
        payload,
        source,
        causeId,
        batchId,
        sequence
      } as Extract<BattleEvent, { type: typeof type }>;
      events.push(event);
      return event;
    },
    failBudget: forceBudgetEvent
  };
}

function emitModifierEvents(
  emitter: ResolverEmitter,
  effect: AtomicEffect,
  applications: ReturnType<typeof applyNumericModifiers>["applications"]
): boolean {
  for (const application of applications) {
    if (
      !emitter.emit(
        "modifier-applied",
        {
          effectId: effect.id,
          modifierId: application.instanceId,
          operation: application.operation,
          before: application.before,
          after: application.after
        },
        effect.source,
        effect.causeId,
        effect.batchId
      )
    ) {
      return false;
    }
  }
  return true;
}

function downPartyMember(
  state: ExpeditionState,
  targetId: Extract<UnitTargetRef, { kind: "party-member" }>["id"],
  emitter: ResolverEmitter,
  effect: AtomicEffect
) {
  const member = state.party.find((candidate) => candidate.id === targetId);
  if (!member || member.downed || member.hp > 0) return;
  member.downed = true;
  member.shield = 0;
  member.sealedNext = false;
  member.rustLevel = Math.min(
    getRustableFaceCapacity(member.id),
    member.rustLevel + 1
  );
  const die = state.dice.find((candidate) => candidate.ownerId === member.id);
  if (die) {
    die.loaded = false;
  }
  emitter.emit(
    "unit-downed",
    { targetId: member.id },
    effect.source,
    effect.id,
    effect.batchId
  );
}

function defeatEnemy(
  state: ExpeditionState,
  enemyId: string,
  emitter: ResolverEmitter,
  effect: AtomicEffect,
  defeat: {
    reason: Extract<BattleEvent, { type: "unit-defeated" }>["payload"]["reason"];
    reward: number;
    deferLayerClear?: boolean;
  } = { reason: "effect", reward: 0 }
) {
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || enemy.hp > 0) return;
  enemy.hp = 0;
  enemy.intent = null;
  emitter.emit(
    "unit-defeated",
    {
      target: { kind: "enemy", id: enemy.id },
      reason: defeat.reason,
      reward: defeat.reward
    },
    effect.source,
    effect.id,
    effect.batchId
  );
  removeStatusesForTarget(
    state,
    `enemy:${enemy.id}`,
    emitter,
    effect,
    "expired"
  );
  if (!defeat.deferLayerClear && state.enemies.every(isEnemyDefeated)) {
    emitter.emit(
      "layer-cleared",
      { layer: state.layer, settlement: null },
      { kind: "system", id: "lifecycle" },
      effect.id,
      effect.batchId
    );
  }
}

function emitStatusRemoved(
  emitter: ResolverEmitter,
  status: StatusInstance,
  reason: "effect" | "cleanse" | "expired",
  source: EffectSourceRef,
  causeId: string | null,
  batchId: string | null
) {
  emitter.emit(
    "status-removed",
    {
      instanceId: status.instanceId,
      definitionId: status.definitionId,
      targetKey: status.targetKey,
      reason
    },
    source,
    causeId,
    batchId
  );
}

function removeStatusesForTarget(
  state: ExpeditionState,
  targetKey: string,
  emitter: ResolverEmitter,
  effect: AtomicEffect,
  reason: "effect" | "cleanse" | "expired"
) {
  const removed = state.statuses.filter((status) => status.targetKey === targetKey);
  if (removed.length === 0) return;
  state.statuses = state.statuses.filter((status) => status.targetKey !== targetKey);
  for (const status of removed) {
    emitStatusRemoved(
      emitter,
      status,
      reason,
      effect.source,
      effect.id,
      effect.batchId
    );
  }
}

function targetExists(state: ExpeditionState, target: TargetRef): boolean {
  switch (target.kind) {
    case "party-member":
      return state.party.some((member) => member.id === target.id);
    case "enemy":
      return state.enemies.some((enemy) => enemy.id === target.id);
    case "die":
      return state.dice.some((die) => die.ownerId === target.ownerId);
    case "intent":
      return state.enemies.some((enemy) => enemy.id === target.enemyId && enemy.intent);
    case "resource":
    case "battle":
      return true;
  }
  const exhaustive: never = target;
  return exhaustive;
}

function applyAtomicEffect(
  state: ExpeditionState,
  effect: AtomicEffect,
  emitter: ResolverEmitter,
  options: EffectResolutionOptions
): EffectResolutionError | null {
  switch (effect.type) {
    case "declare-action":
    case "complete-action": {
      emitter.emit(
        effect.type === "declare-action" ? "action-declared" : "action-resolved",
        { actorId: effect.actorId, verb: effect.verb, target: effect.target },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "complete-enemy-intent": {
      if (state.mode.type !== "enemy-turn") return "invalid-effect-target";
      const resolvedIndex = state.mode.enemyOrder.indexOf(effect.event.enemyId);
      if (resolvedIndex >= 0) {
        state.mode.cursor = Math.max(state.mode.cursor, resolvedIndex + 1);
      }
      emitter.emit(
        "enemy-intent-resolved",
        effect.event,
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "prepare-enemy-turn": {
      if (state.mode.type !== "player-turn") return "invalid-effect-target";
      Object.assign(state, {
        mode: {
          type: "enemy-turn",
          enemyOrder: [...effect.enemyOrder],
          cursor: 0,
          closingHand: structuredClone(effect.closingHand),
          outcome: null
        },
        result: null
      });
      state.undoStack = [];
      const evaluated = emitter.emit(
        "hand-evaluated",
        {
          hand: effect.hand,
          multiplierBefore: effect.multiplierBefore,
          multiplierAfter: effect.multiplierAfter
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      emitter.emit(
        "enemy-turn-prepared",
        { enemyOrder: [...effect.enemyOrder] },
        effect.source,
        evaluated?.id ?? effect.causeId,
        effect.batchId
      );
      break;
    }

    case "commit-dice-roll": {
      if (
        (effect.roll === "initial" && state.mode.type !== "awaiting-roll") ||
        (effect.roll === "reroll" && state.mode.type !== "player-turn")
      ) {
        return "invalid-effect-target";
      }
      for (const result of effect.results) {
        const die = state.dice.find((candidate) => candidate.ownerId === result.ownerId);
        if (!die) return "invalid-effect-target";
        die.faceIndex = result.faceIndex;
        if (effect.roll === "initial") {
          die.loaded = false;
          die.spent = false;
        }
      }
      for (const ownerId of effect.autoLoadOwnerIds) {
        const die = state.dice.find((candidate) => candidate.ownerId === ownerId);
        if (!die) return "invalid-effect-target";
        die.loaded = true;
      }
      state.lastTossed = effect.results.map((result) => result.ownerId);
      state.rerollsRemaining = Math.max(0, effect.rerollsRemaining);
      state.undoStack = [];
      if (effect.roll === "initial") {
        Object.assign(state, {
          mode: { type: "player-turn" },
          result: null
        });
      }
      emitter.emit(
        "dice-rolled",
        {
          roll: effect.roll,
          results: structuredClone(effect.results),
          rerollsRemaining: state.rerollsRemaining
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "append-log":
      state.log.push({
        round: state.round,
        layer: state.layer,
        tone: effect.tone,
        text: effect.text
      });
      break;

    case "append-fact":
      if (!state.facts.includes(effect.text)) state.facts.push(effect.text);
      break;

    case "damage": {
      const modified = applyNumericModifiers(
        effect.amount,
        "before-damage",
        effect.target,
        effect.tags,
        options.modifiers ?? []
      );
      if (!emitModifierEvents(emitter, effect, modified.applications)) {
        return "event-budget-exceeded";
      }
      const amount = Math.max(0, Math.round(modified.value));
      if (modified.target.kind === "party-member") {
        const member = state.party.find((candidate) => candidate.id === modified.target.id);
        if (!member || member.downed) return "invalid-effect-target";
        const hpBefore = member.hp;
        member.hp = Math.max(0, member.hp - amount);
        if (
          !emitter.emit(
            "damage-applied",
            {
              target: modified.target,
              raw: effect.rawAmount ?? effect.amount,
              modified: amount,
              applied: hpBefore - member.hp,
              hpBefore,
              hpAfter: member.hp,
              lethal: member.hp <= 0
            },
            effect.source,
            effect.causeId,
            effect.batchId
          )
        ) {
          return "event-budget-exceeded";
        }
        downPartyMember(state, member.id, emitter, effect);
      } else {
        const enemy = state.enemies.find((candidate) => candidate.id === modified.target.id);
        if (!enemy || isEnemyDefeated(enemy)) return "invalid-effect-target";
        const hpBefore = enemy.hp;
        enemy.hp = Math.max(0, enemy.hp - amount);
        if (
          !emitter.emit(
            "damage-applied",
            {
              target: modified.target,
              raw: effect.rawAmount ?? effect.amount,
              modified: amount,
              applied: hpBefore - enemy.hp,
              hpBefore,
              hpAfter: enemy.hp,
              lethal: enemy.hp <= 0
            },
            effect.source,
            effect.causeId,
            effect.batchId
          )
        ) {
          return "event-budget-exceeded";
        }
        defeatEnemy(state, enemy.id, emitter, effect, effect.defeat);
      }
      break;
    }

    case "report-damage":
      emitter.emit(
        "damage-applied",
        effect.payload,
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;

    case "heal": {
      const member = state.party.find((candidate) => candidate.id === effect.target.id);
      if (!member || member.downed) return "invalid-effect-target";
      const modified = applyNumericModifiers(
        effect.amount,
        "before-heal",
        effect.target,
        effect.tags,
        options.modifiers ?? []
      );
      if (!emitModifierEvents(emitter, effect, modified.applications)) {
        return "event-budget-exceeded";
      }
      const amount = Math.max(0, Math.round(modified.value));
      const hpBefore = member.hp;
      member.hp = Math.min(MAX_HP, member.hp + amount);
      if (
        !emitter.emit(
          "healing-applied",
          {
            actorId:
              effect.source.kind === "character"
                ? effect.source.id
                : effect.source.kind === "die"
                  ? effect.source.ownerId
                  : member.id,
            targetId: member.id,
            requested: effect.amount,
            applied: member.hp - hpBefore,
            hpBefore,
            hpAfter: member.hp,
            cost: Math.max(0, effect.cost ?? 0)
          },
          effect.source,
          effect.causeId,
          effect.batchId
        )
      ) {
        return "event-budget-exceeded";
      }
      break;
    }

    case "guard": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      const member = state.party.find((candidate) => candidate.id === effect.protectedId);
      if (
        !enemy ||
        isEnemyDefeated(enemy) ||
        enemy.intent?.type !== "attack" ||
        !member
      ) {
        return "invalid-effect-target";
      }
      const amount = Math.max(0, effect.amount);
      const blockedBefore = enemy.blocked;
      const shieldBefore = member.shield;
      enemy.blocked += amount;
      member.shield += amount;
      emitter.emit(
        "guard-applied",
        {
          actorId: effect.actorId,
          protectedId: effect.protectedId,
          enemyId: effect.enemyId,
          amount,
          blockedBefore,
          blockedAfter: enemy.blocked,
          shieldBefore,
          shieldAfter: member.shield
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "revive": {
      const member = state.party.find((candidate) => candidate.id === effect.target.id);
      if (!member || !member.downed) return "invalid-effect-target";
      member.hp = Math.max(1, Math.min(MAX_HP, Math.round(effect.hp)));
      member.downed = false;
      emitter.emit(
        "unit-revived",
        { targetId: member.id, hp: member.hp },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "cleanse": {
      if (!targetExists(state, effect.target)) return "invalid-effect-target";
      const key = targetRefKey(effect.target);
      const removed = state.statuses.filter(
        (status) =>
          status.targetKey === key &&
          !status.tags.includes("unremovable") &&
          (effect.definitionIds?.includes(status.definitionId) ||
            effect.statusTags?.some((tag) => status.tags.includes(tag)) ||
            (!effect.definitionIds && !effect.statusTags))
      );
      state.statuses = state.statuses.filter((status) => !removed.includes(status));
      for (const status of removed) {
        emitStatusRemoved(
          emitter,
          status,
          "cleanse",
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;
    }

    case "apply-status": {
      if (!targetExists(state, effect.target)) return "invalid-effect-target";
      const targetKey = targetRefKey(effect.target);
      const immune = state.statuses.some(
        (status) =>
          (status.targetKey === targetKey || status.targetKey === "battle") &&
          status.tags.includes(`immune:${effect.status.definitionId}`)
      );
      if (immune) break;
      const existing = state.statuses.find(
        (status) =>
          status.targetKey === targetKey &&
          status.definitionId === effect.status.definitionId
      );
      if (!existing) {
        const status: StatusInstance = {
          ...structuredClone(effect.status),
          kind: "status",
          targetKey,
          stacks: Math.min(effect.status.maxStacks, Math.max(1, effect.status.stacks))
        };
        state.statuses.push(status);
        emitter.emit(
          "status-applied",
          {
            instanceId: status.instanceId,
            definitionId: status.definitionId,
            target: effect.target,
            stacks: status.stacks
          },
          effect.source,
          effect.causeId,
          effect.batchId
        );
        break;
      }

      switch (effect.refresh) {
        case "replace":
          Object.assign(existing, structuredClone(effect.status), { targetKey, kind: "status" });
          existing.stacks = Math.min(existing.maxStacks, Math.max(1, existing.stacks));
          break;
        case "refresh":
          existing.duration = structuredClone(effect.status.duration);
          break;
        case "stack":
          existing.stacks = Math.min(
            existing.maxStacks,
            existing.stacks + Math.max(1, effect.status.stacks)
          );
          if (effect.status.duration) existing.duration = structuredClone(effect.status.duration);
          break;
        case "extend":
          if (existing.duration && effect.status.duration) {
            existing.duration.remaining += effect.status.duration.remaining;
          } else if (effect.status.duration) {
            existing.duration = structuredClone(effect.status.duration);
          }
          break;
      }
      emitter.emit(
        "status-modified",
        {
          instanceId: existing.instanceId,
          stacks: existing.stacks,
          durationRemaining: existing.duration?.remaining ?? null
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "remove-status": {
      const index = state.statuses.findIndex((status) => status.instanceId === effect.instanceId);
      if (index < 0) return "invalid-effect-target";
      const [removed] = state.statuses.splice(index, 1);
      emitStatusRemoved(
        emitter,
        removed!,
        effect.reason ?? "effect",
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-status": {
      const status = state.statuses.find((candidate) => candidate.instanceId === effect.instanceId);
      if (!status) return "invalid-effect-target";
      if (effect.stacksDelta) {
        status.stacks = Math.max(
          0,
          Math.min(status.maxStacks, status.stacks + effect.stacksDelta)
        );
      }
      if (effect.durationDelta && status.duration) {
        status.duration.remaining = Math.max(
          0,
          status.duration.remaining + effect.durationDelta
        );
      }
      if (status.stacks <= 0 || (status.duration && status.duration.remaining <= 0)) {
        state.statuses = state.statuses.filter(
          (candidate) => candidate.instanceId !== status.instanceId
        );
        emitStatusRemoved(
          emitter,
          status,
          "effect",
          effect.source,
          effect.causeId,
          effect.batchId
        );
        break;
      }
      emitter.emit(
        "status-modified",
        {
          instanceId: status.instanceId,
          stacks: status.stacks,
          durationRemaining: status.duration?.remaining ?? null
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-stat": {
      let before: number;
      let after: number;
      if (effect.target.kind === "party-member") {
        const member = state.party.find((candidate) => candidate.id === effect.target.id);
        if (!member || (effect.stat !== "hp" && effect.stat !== "shield")) {
          return "invalid-effect-target";
        }
        if (effect.stat === "hp") {
          before = member.hp;
          member.hp = Math.max(
            0,
            Math.min(
              MAX_HP,
              effect.operation === "set" ? effect.value : member.hp + effect.value
            )
          );
          after = member.hp;
          downPartyMember(state, member.id, emitter, effect);
        } else {
          before = member.shield;
          member.shield = Math.max(
            0,
            effect.operation === "set" ? effect.value : member.shield + effect.value
          );
          after = member.shield;
        }
      } else {
        const enemy = state.enemies.find((candidate) => candidate.id === effect.target.id);
        if (!enemy || effect.stat === "shield") return "invalid-effect-target";
        const key = effect.stat === "max-hp" ? "maxHp" : effect.stat;
        before = enemy[key];
        enemy[key] = Math.max(
          0,
          effect.operation === "set" ? effect.value : enemy[key] + effect.value
        );
        if (key === "maxHp") enemy.hp = Math.min(enemy.hp, enemy.maxHp);
        after = enemy[key];
        if (key === "hp") defeatEnemy(state, enemy.id, emitter, effect);
      }
      emitter.emit(
        "stat-modified",
        { target: effect.target, stat: effect.stat, before, after },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-die": {
      const die = state.dice.find((candidate) => candidate.ownerId === effect.ownerId);
      if (!die) return "invalid-effect-target";
      const wasSpent = die.spent;
      const changed = Object.keys(effect.patch);
      Object.assign(die, effect.patch);
      emitter.emit(
        "die-modified",
        { ownerId: effect.ownerId, changed },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      if (!wasSpent && die.spent) {
        emitter.emit(
          "die-spent",
          { ownerId: effect.ownerId },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;
    }

    case "set-die-load": {
      const die = state.dice[effect.dieIndex];
      if (!die || die.ownerId !== effect.ownerId) return "invalid-effect-target";
      die.loaded = effect.loaded;
      emitter.emit(
        "die-load-changed",
        {
          ownerId: die.ownerId,
          dieIndex: effect.dieIndex,
          loaded: die.loaded
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-party-member": {
      const member = state.party.find((candidate) => candidate.id === effect.targetId);
      if (!member) return "invalid-effect-target";
      Object.assign(member, effect.patch);
      if (effect.patch.rustLevel !== undefined) {
        member.rustLevel = Math.max(
          0,
          Math.min(getRustableFaceCapacity(member.id), Math.trunc(effect.patch.rustLevel))
        );
      }
      break;
    }

    case "modify-enemy": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      if (!enemy) return "invalid-effect-target";
      const wasDefeated = isEnemyDefeated(enemy);
      Object.assign(enemy, effect.patch);
      if (!wasDefeated && effect.defeat) {
        enemy.hp = 0;
        enemy.intent = null;
        removeStatusesForTarget(
          state,
          `enemy:${enemy.id}`,
          emitter,
          effect,
          "expired"
        );
        emitter.emit(
          "unit-defeated",
          {
            target: { kind: "enemy", id: enemy.id },
            reason: effect.defeat.reason,
            reward: effect.defeat.reward
          },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;
    }

    case "modify-battle-metrics":
      Object.assign(state, effect.patch);
      break;

    case "set-round":
      state.round = Math.max(0, Math.trunc(effect.round));
      break;

    case "start-player-round": {
      if (state.mode.type !== "enemy-turn") return "invalid-effect-target";
      Object.assign(state, {
        mode: { type: "awaiting-roll" },
        result: null
      });
      state.rerollsRemaining = Math.max(0, effect.rerollsRemaining);
      state.lastTossed = [];
      state.dice = structuredClone(effect.dice);
      state.undoStack = [];
      for (const member of state.party) {
        member.sealedNext = false;
        member.shield = 0;
      }
      for (const enemy of state.enemies) {
        enemy.blocked = 0;
        if (isEnemyDefeated(enemy)) enemy.intent = null;
      }
      emitter.emit(
        "round-started",
        { round: state.round },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "record-layer-settlement":
      state.lastLayerSettlement = structuredClone(effect.settlement);
      break;

    case "enter-greed":
      Object.assign(state, {
        mode: { type: "greed" },
        result: null
      });
      break;

    case "finish-expedition":
      Object.assign(state, {
        mode: { type: "finished" },
        result: structuredClone(effect.result)
      });
      state.undoStack = [];
      if (effect.announce) {
        emitter.emit(
          "expedition-finished",
          { result: effect.result },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;

    case "finalize-round":
      if (state.mode.type === "enemy-turn") {
        state.mode.outcome = effect.outcome;
      }
      if (effect.outcome === "layer-cleared") {
        emitter.emit(
          "layer-cleared",
          { layer: state.layer, settlement: structuredClone(effect.settlement) },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      emitter.emit(
        "round-resolved",
        { outcome: effect.outcome, round: state.round },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      if (state.mode.type === "finished" && state.result) {
        emitter.emit(
          "expedition-finished",
          { result: state.result },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;

    case "start-layer":
      Object.assign(state, {
        layer: effect.layer,
        deepestLayer: effect.deepestLayer,
        round: 0,
        layerStartEnemies: effect.enemies.length,
        lastTossed: [],
        stalledRounds: 0,
        lastEnemyHp: 0,
        lastLayerSettlement: null,
        enemies: structuredClone(effect.enemies),
        enemySequence: effect.enemySequence,
        mode: {
          type: "enemy-turn",
          enemyOrder: [],
          cursor: 0,
          closingHand: null,
          outcome: null
        },
        result: null
      });
      break;

    case "announce-layer-started":
      emitter.emit(
        "layer-started",
        { layer: effect.layer, round: effect.round },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;

    case "modify-intent": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      if (!enemy || isEnemyDefeated(enemy)) return "invalid-effect-target";
      const operation = effect.operation;
      switch (operation) {
        case "replace":
          if (!effect.intent) return "invalid-effect-target";
          enemy.intent = structuredClone(effect.intent);
          break;
        case "cancel":
          enemy.intent = null;
          break;
        case "add-block":
          if (enemy.intent?.type !== "attack") return "invalid-effect-target";
          enemy.blocked += Math.max(0, effect.amount ?? 0);
          break;
        case "retarget":
          if (enemy.intent?.type !== "attack" && enemy.intent?.type !== "seal") {
            return "invalid-effect-target";
          }
          if (!effect.targetId) return "invalid-effect-target";
          enemy.intent.targetId = effect.targetId;
          break;
        default: {
          const exhaustive: never = operation;
          return exhaustive;
        }
      }
      emitter.emit(
        "intent-modified",
        { enemyId: enemy.id, operation: effect.operation },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "spawn-unit": {
      if (state.enemies.some((enemy) => enemy.id === effect.unit.id)) {
        return "invalid-effect-target";
      }
      state.enemies.push(structuredClone(effect.unit));
      if (effect.enemySequence !== undefined) {
        state.enemySequence = Math.max(state.enemySequence, effect.enemySequence);
      }
      emitter.emit(
        "unit-spawned",
        { enemyId: effect.unit.id },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "despawn-unit": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      if (!enemy || isEnemyDefeated(enemy)) return "invalid-effect-target";
      enemy.hp = 0;
      enemy.intent = null;
      removeStatusesForTarget(
        state,
        `enemy:${enemy.id}`,
        emitter,
        effect,
        "expired"
      );
      emitter.emit(
        "unit-despawned",
        { enemyId: enemy.id, reason: effect.reason },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      if (state.enemies.every(isEnemyDefeated)) {
        emitter.emit(
          "layer-cleared",
          { layer: state.layer, settlement: null },
          { kind: "system", id: "lifecycle" },
          effect.id,
          effect.batchId
        );
      }
      break;
    }

    case "flee-unit": {
      const enemy = state.enemies.find((candidate) => candidate.id === effect.enemyId);
      if (!enemy || isEnemyDefeated(enemy)) return "invalid-effect-target";
      enemy.hp = 0;
      enemy.intent = null;
      removeStatusesForTarget(
        state,
        `enemy:${enemy.id}`,
        emitter,
        effect,
        "expired"
      );
      emitter.emit(
        "unit-despawned",
        { enemyId: enemy.id, reason: "fled" },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-resource": {
      const before =
        effect.resource === "gold"
          ? state.gold
          : effect.resource === "bag-gold"
            ? state.bagGold
            : state.handMultiplier;
      const after = Math.max(
        0,
        effect.operation === "set" ? effect.value : before + effect.value
      );
      if (effect.resource === "gold") state.gold = after;
      else if (effect.resource === "bag-gold") state.bagGold = after;
      else state.handMultiplier = after;
      emitter.emit(
        "resource-changed",
        {
          resource: effect.resource,
          before,
          after,
          delta: after - before,
          reason: effect.reason ?? "effect"
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-reward": {
      if (effect.operation === "add-gold") {
        const before = state.gold;
        state.gold = Math.max(0, state.gold + effect.value);
        emitter.emit(
          "resource-changed",
          {
            resource: "gold",
            before,
            after: state.gold,
            delta: state.gold - before,
            reason: "effect"
          },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      } else {
        const before = state.handMultiplier;
        state.handMultiplier = Math.max(0, (1 + before) * effect.value - 1);
        emitter.emit(
          "resource-changed",
          {
            resource: "hand-multiplier",
            before,
            after: state.handMultiplier,
            delta: state.handMultiplier - before,
            reason: "effect"
          },
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;
    }

    case "consume-item": {
      const item = state.loadout.items.find(
        (candidate) => candidate.instanceId === effect.instanceId
      );
      if (!item || item.charges <= 0 || effect.amount <= 0) {
        return "invalid-effect-target";
      }
      const before = item.charges;
      item.charges = Math.max(0, before - effect.amount);
      emitter.emit(
        "item-consumed",
        {
          instanceId: item.instanceId,
          definitionId: item.definitionId,
          chargesBefore: before,
          chargesAfter: item.charges,
          amount: before - item.charges
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "consume-equipment-durability": {
      const equipment = state.loadout.equipment.find(
        (candidate) => candidate.instanceId === effect.instanceId
      );
      if (!equipment || equipment.durability <= 0 || effect.amount <= 0) {
        return "invalid-effect-target";
      }
      const before = equipment.durability;
      equipment.durability = Math.max(0, before - effect.amount);
      emitter.emit(
        "equipment-durability-changed",
        {
          instanceId: equipment.instanceId,
          definitionId: equipment.definitionId,
          durabilityBefore: before,
          durabilityAfter: equipment.durability,
          amount: before - equipment.durability,
          broken: equipment.durability === 0
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "apply-encounter-rule": {
      if (state.encounterRules.some((rule) => rule.instanceId === effect.rule.instanceId)) {
        return "invalid-effect-target";
      }
      state.encounterRules.push({ ...structuredClone(effect.rule), kind: "encounter-rule" });
      emitter.emit(
        "encounter-rule-applied",
        { instanceId: effect.rule.instanceId, definitionId: effect.rule.definitionId },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "remove-encounter-rule": {
      const index = state.encounterRules.findIndex(
        (rule) => rule.instanceId === effect.instanceId
      );
      if (index < 0) return "invalid-effect-target";
      const [removed] = state.encounterRules.splice(index, 1);
      emitter.emit(
        "encounter-rule-removed",
        { instanceId: removed!.instanceId, definitionId: removed!.definitionId },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }

  if (
    !emitter.emit(
      "effect-applied",
      { effectId: effect.id, effectType: effect.type, target: effectTarget(effect) },
      effect.source,
      effect.causeId,
      effect.batchId
    )
  ) {
    return "event-budget-exceeded";
  }
  return null;
}

/** Resolve a deterministic batch of serializable atomic effects and reactions. */
export function resolveAtomicEffects(
  input: ExpeditionState,
  effects: readonly AtomicEffect[],
  options: EffectResolutionOptions = {}
): EffectResolution {
  if (
    effects.length === 0 &&
    input.pendingEffects.length === 0 &&
    input.pendingReactions.length === 0
  ) {
    return { state: input, events: [], error: null };
  }

  const state = cloneBattleState(input);
  const effectiveOptions = mergeEffectResolutionOptions(input, options);
  const maxEvents = Math.max(
    1,
    effectiveOptions.maxEvents ?? DEFAULT_EFFECT_EVENT_BUDGET
  );
  const maxDepth = Math.max(
    0,
    effectiveOptions.maxDepth ?? DEFAULT_EFFECT_DEPTH_LIMIT
  );
  const emitter = createEmitter(state, maxEvents);
  const queue: QueuedEffect[] = effects.map((effect) => ({ effect, depth: 0 }));
  const reacted = new Set<string>();
  let eventCursor = 0;
  let error: EffectResolutionError | null = null;

  /* Resolution is synchronous and atomic; no partially rewritten queue is observable. */
  state.pendingEffects = [];
  state.pendingReactions = [];

  while (queue.length > 0 && !error) {
    const current = queue.shift()!;
    if (current.depth > maxDepth) {
      emitter.failBudget("depth", maxDepth, current.effect.source);
      error = "trigger-depth-exceeded";
      break;
    }

    error = applyAtomicEffect(state, current.effect, emitter, effectiveOptions);
    if (error) break;

    while (eventCursor < emitter.events.length && !error) {
      const event = emitter.events[eventCursor++]!;
      if (event.type === "resolution-budget-exceeded") {
        error = "event-budget-exceeded";
        break;
      }
      const reactions = collectEventReactions(
        state,
        event,
        effectiveOptions.reactions ?? [],
        effectiveOptions.reactionRegistry ?? {},
        reacted
      );
      if (reactions.error) {
        error = reactions.error;
        emitter.emit(
          "resolution-failed",
          { error, effectId: current.effect.id },
          current.effect.source,
          event.id,
          current.effect.batchId
        );
        break;
      }
      if (reactions.effects.length === 0) continue;
      const nextDepth = current.depth + 1;
      if (nextDepth > maxDepth) {
        emitter.failBudget("depth", maxDepth, current.effect.source);
        error = "trigger-depth-exceeded";
        break;
      }
      const queued = reactions.effects.map((effect) => ({ effect, depth: nextDepth }));
      queue.push(...queued);
    }
  }

  if (error && !emitter.events.some((event) => event.type.includes("resolution-"))) {
    emitter.emit(
      "resolution-failed",
      { error, effectId: queue[0]?.effect.id ?? null },
      { kind: "system", id: "resolver" },
      null,
      null
    );
  }
  state.pendingEffects = [];
  state.pendingReactions = [];
  state.eventSequence = input.eventSequence + emitter.events.length;
  return { state, events: emitter.events, error };
}

/** Commit one player command and its complete reaction chain as one undo checkpoint. */
export function resolveEffectsCommand(
  input: ExpeditionState,
  actionLabel: string,
  effects: readonly AtomicEffect[],
  options: EffectResolutionOptions = {}
): EffectResolution {
  const resolution = resolveAtomicEffects(input, effects, options);
  if (resolution.error) return resolution;
  const cloned = cloneBattleState(input);
  const { undoStack: _undoStack, ...checkpointState } = cloned;
  resolution.state.undoStack = [
    ...input.undoStack,
    { action: actionLabel, state: checkpointState }
  ];
  return resolution;
}
