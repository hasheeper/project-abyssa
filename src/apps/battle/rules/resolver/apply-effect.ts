import type {
  AtomicEffect,
  EffectResolutionError,
  EffectResolutionOptions
} from "../../domain/effects";
import type { ExpeditionState } from "../../domain/state";
import { applyCombatEffect } from "./combat-effects";
import { applyDiceEffect } from "./dice-effects";
import type { ResolverEmitter } from "./emitter";
import { applyLifecycleEffect } from "./lifecycle-effects";
import { applyResourceEffect } from "./resource-effects";
import { applyStatusEffect } from "./status-effects";
import { effectTarget } from "./targets";

export function applyAtomicEffect(
  state: ExpeditionState,
  effect: AtomicEffect,
  emitter: ResolverEmitter,
  options: EffectResolutionOptions
): EffectResolutionError | null {
  let error: EffectResolutionError | null;

  switch (effect.type) {
    case "declare-action":
    case "complete-action":
    case "complete-enemy-intent":
    case "prepare-enemy-turn":
    case "append-log":
    case "append-fact":
    case "modify-enemy":
    case "modify-battle-metrics":
    case "set-round":
    case "start-player-round":
    case "record-layer-settlement":
    case "enter-greed":
    case "finish-expedition":
    case "finalize-round":
    case "start-layer":
    case "announce-layer-started":
    case "modify-intent":
    case "spawn-unit":
    case "despawn-unit":
    case "flee-unit":
      error = applyLifecycleEffect(state, effect, emitter);
      break;

    case "commit-dice-roll":
    case "modify-die":
    case "set-die-load":
    case "modify-party-member":
      error = applyDiceEffect(state, effect, emitter);
      break;

    case "damage":
    case "report-damage":
    case "heal":
    case "guard":
    case "revive":
    case "modify-stat":
      error = applyCombatEffect(state, effect, emitter, options);
      break;

    case "cleanse":
    case "apply-status":
    case "remove-status":
    case "modify-status":
      error = applyStatusEffect(state, effect, emitter);
      break;

    case "modify-resource":
    case "modify-reward":
    case "consume-item":
    case "consume-equipment-durability":
    case "apply-encounter-rule":
    case "remove-encounter-rule":
      error = applyResourceEffect(state, effect, emitter);
      break;

    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }

  if (error) return error;
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
