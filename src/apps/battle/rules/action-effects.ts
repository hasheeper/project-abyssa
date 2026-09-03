import { ACTION_EFFECT_DEFINITIONS } from "../content/effect-definitions";
import type {
  ActionEffectDefinitionRegistry,
  AtomicEffect,
  AtomicEffectBase
} from "../domain/effects";
import type { ExpeditionState } from "../domain/state";
import type { BattleResource } from "../domain/targets";

export type ActionEffectContribution = {
  effects: AtomicEffect[];
  resourceCosts: Partial<Record<BattleResource, number>>;
};

function resourceValue(state: ExpeditionState, resource: BattleResource): number {
  if (resource === "gold") return state.gold;
  if (resource === "bag-gold") return state.bagGold;
  return state.handMultiplier;
}

/** Expand data-only face definitions into existing atomic effects. */
export function buildActionEffectContribution(
  state: ExpeditionState,
  trigger: "heal",
  definitionIds: readonly string[],
  createBase: (suffix: string, tags?: string[]) => AtomicEffectBase,
  definitions: ActionEffectDefinitionRegistry = ACTION_EFFECT_DEFINITIONS
): ActionEffectContribution {
  const effects: AtomicEffect[] = [];
  const resourceCosts: Partial<Record<BattleResource, number>> = {};
  const projected = new Map<BattleResource, number>();

  definitionIds.forEach((definitionId, index) => {
    const definition = definitions[definitionId];
    if (!definition || definition.trigger !== trigger) return;
    const effect = definition.effect;
    switch (effect.type) {
      case "resource-cost": {
        const available = projected.get(effect.resource) ?? resourceValue(state, effect.resource);
        const actualCost = Math.min(effect.amount, available);
        projected.set(effect.resource, Math.max(0, available - effect.amount));
        resourceCosts[effect.resource] =
          (resourceCosts[effect.resource] ?? 0) + actualCost;
        const suffix = definitionIds.length === 1 ? "" : `${index}:`;
        effects.push(
          {
            ...createBase(`${suffix}cost`, ["cost"]),
            type: "modify-resource",
            resource: effect.resource,
            operation: "add",
            value: -effect.amount,
            reason: effect.reason
          },
          {
            ...createBase(`${suffix}cost-log`),
            type: "append-log",
            tone: "bad",
            text: effect.log
          }
        );
        if (effect.fact) {
          effects.push({
            ...createBase(`${suffix}fact`),
            type: "append-fact",
            text: effect.fact
          });
        }
        break;
      }
    }
  });

  return { effects, resourceCosts };
}
