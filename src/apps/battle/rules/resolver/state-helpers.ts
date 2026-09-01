import type { AtomicEffect, UnitTargetRef } from "../../domain/effects";
import type { BattleEvent } from "../../domain/events";
import type { ExpeditionState, StatusInstance } from "../../domain/state";
import type { EffectSourceRef } from "../../domain/targets";
import { isEnemyDefeated } from "../../selectors/battle-selectors";
import { getRustableFaceCapacity } from "../dice";
import { applyNumericModifiers } from "../modifiers";
import type { ResolverEmitter } from "./emitter";

export function emitModifierEvents(
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

export function downPartyMember(
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
  if (die) die.loaded = false;
  emitter.emit(
    "unit-downed",
    { targetId: member.id },
    effect.source,
    effect.id,
    effect.batchId
  );
}

export function defeatEnemy(
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
  removeStatusesForTarget(state, `enemy:${enemy.id}`, emitter, effect, "expired");
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

export function emitStatusRemoved(
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

export function removeStatusesForTarget(
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
