import type { AtomicEffect, EffectResolutionError } from "../../domain/effects";
import type { ExpeditionState } from "../../domain/state";
import type { ResolverEmitter } from "./emitter";

type ResourceEffect = Extract<
  AtomicEffect,
  {
    type:
      | "modify-resource"
      | "modify-reward"
      | "consume-item"
      | "consume-equipment-durability"
      | "apply-encounter-rule"
      | "remove-encounter-rule";
  }
>;

export function applyResourceEffect(
  state: ExpeditionState,
  effect: ResourceEffect,
  emitter: ResolverEmitter
): EffectResolutionError | null {
  switch (effect.type) {
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
  return null;
}
