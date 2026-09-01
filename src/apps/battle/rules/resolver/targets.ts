import type { AtomicEffect } from "../../domain/effects";
import type { ExpeditionState } from "../../domain/state";
import type { TargetRef } from "../../domain/targets";

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

export function effectTarget(effect: AtomicEffect): TargetRef | null {
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
    case "commit-dice-roll":
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

export function targetExists(state: ExpeditionState, target: TargetRef): boolean {
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
