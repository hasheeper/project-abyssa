import {
  BATTLE_EFFECT_DEFINITIONS,
  BATTLE_REACTION_REGISTRY
} from "../content/effect-definitions";
import type {
  BattleEffectDefinitionRegistry,
  EffectModifier,
  EffectResolutionOptions,
  ReactionBinding,
  ReactionRegistry
} from "../domain/effects";
import type {
  BattleContentInstanceBase,
  EffectInstance,
  ExpeditionState,
  JsonValue
} from "../domain/state";

type RuntimeInstance = Pick<
  BattleContentInstanceBase | EffectInstance,
  "instanceId" | "definitionId" | "sourceId" | "data"
>;

function isJsonRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reactionData(
  instance: RuntimeInstance,
  templateData: JsonValue
): JsonValue {
  return {
    instanceId: instance.instanceId,
    definition: templateData,
    instance: instance.data,
    ...(isJsonRecord(templateData) ? templateData : {}),
    ...(isJsonRecord(instance.data) ? instance.data : {})
  };
}

function activeInstances(state: ExpeditionState): RuntimeInstance[] {
  return [
    ...state.loadout.items.filter((instance) => instance.charges > 0),
    ...state.loadout.equipment.filter((instance) => instance.durability > 0),
    ...state.loadout.traits,
    ...state.statuses,
    ...state.encounterRules
  ];
}

function hasActiveInstances(state: ExpeditionState): boolean {
  return (
    state.loadout.items.some((instance) => instance.charges > 0) ||
    state.loadout.equipment.some((instance) => instance.durability > 0) ||
    state.loadout.traits.length > 0 ||
    state.statuses.length > 0 ||
    state.encounterRules.length > 0
  );
}

export function compileEffectRuntime(
  state: ExpeditionState,
  definitions: BattleEffectDefinitionRegistry = BATTLE_EFFECT_DEFINITIONS
): Pick<EffectResolutionOptions, "modifiers" | "reactions"> {
  const modifiers: EffectModifier[] = [];
  const reactions: ReactionBinding[] = [];

  for (const instance of activeInstances(state)) {
    const definition = definitions[instance.definitionId];
    if (!definition) continue;
    definition.modifiers.forEach((template, index) => {
      modifiers.push({
        ...template,
        instanceId: `${instance.instanceId}:modifier:${index}`,
        definitionId: definition.definitionId,
        sourceId: instance.sourceId
      });
    });
    definition.reactions.forEach((template, index) => {
      reactions.push({
        ...template,
        instanceId: `${instance.instanceId}:reaction:${index}`,
        definitionId: definition.definitionId,
        sourceId: instance.sourceId,
        data: reactionData(instance, template.data)
      });
    });
  }

  return { modifiers, reactions };
}

export function mergeEffectResolutionOptions(
  state: ExpeditionState,
  options: EffectResolutionOptions
): EffectResolutionOptions {
  if (!hasActiveInstances(state)) return options;
  const compiled = compileEffectRuntime(
    state,
    options.effectDefinitions ?? BATTLE_EFFECT_DEFINITIONS
  );
  const reactionRegistry: ReactionRegistry = {
    ...BATTLE_REACTION_REGISTRY,
    ...options.reactionRegistry
  };
  return {
    ...options,
    modifiers: [...(compiled.modifiers ?? []), ...(options.modifiers ?? [])],
    reactions: [...(compiled.reactions ?? []), ...(options.reactions ?? [])],
    reactionRegistry
  };
}
