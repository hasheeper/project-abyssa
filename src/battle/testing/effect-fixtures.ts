import type {
  BattleEffectDefinitionRegistry,
  ReactionRegistry
} from "../domain/effects";
import type {
  CharacterId,
  EquipmentInstance,
  JsonValue,
  TraitInstance
} from "../domain/state";

export const FIXTURE_TAGGED_SPECIALIST = "fixture.tagged-specialist";
export const FIXTURE_POISON_ON_HIT = "fixture.poison-on-hit";
export const FIXTURE_KILL_BOUNTY = "fixture.kill-bounty";
export const FIXTURE_AOE_LIFESTEAL = "fixture.aoe-lifesteal";
export const FIXTURE_POISON_STATUS = "fixture.poison";

export const FIXTURE_EFFECT_DEFINITIONS: BattleEffectDefinitionRegistry = {
  [FIXTURE_TAGGED_SPECIALIST]: {
    definitionId: FIXTURE_TAGGED_SPECIALIST,
    modifiers: [{
      priority: 10,
      window: "before-damage",
      operation: "multiply",
      value: 2,
      requiredTags: ["target:anomaly"],
      targetKinds: ["enemy"]
    }],
    reactions: []
  },
  [FIXTURE_POISON_ON_HIT]: {
    definitionId: FIXTURE_POISON_ON_HIT,
    modifiers: [],
    reactions: [{
      priority: 20,
      eventTypes: ["damage-applied"],
      data: null
    }]
  },
  [FIXTURE_KILL_BOUNTY]: {
    definitionId: FIXTURE_KILL_BOUNTY,
    modifiers: [],
    reactions: [{
      priority: 30,
      eventTypes: ["unit-defeated"],
      data: { gold: 7 }
    }]
  },
  [FIXTURE_AOE_LIFESTEAL]: {
    definitionId: FIXTURE_AOE_LIFESTEAL,
    modifiers: [],
    reactions: [{
      priority: 40,
      eventTypes: ["damage-applied"],
      data: { healing: 1 }
    }]
  }
};

function dataRecord(value: JsonValue): Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};
}

export const FIXTURE_REACTION_REGISTRY: ReactionRegistry = {
  [FIXTURE_POISON_ON_HIT]: ({ event, binding }) => {
    if (
      event.type !== "damage-applied" ||
      event.payload.target.kind !== "enemy" ||
      event.payload.applied <= 0
    ) {
      return [];
    }
    const data = dataRecord(binding.data);
    const instanceId = String(data.instanceId ?? binding.instanceId);
    return [{
      id: `fixture:poison:${event.id}`,
      source: { kind: "equipment", instanceId },
      causeId: event.id,
      batchId: event.batchId,
      tags: ["poison"],
      type: "apply-status",
      target: event.payload.target,
      refresh: "stack",
      status: {
        instanceId: `poison:${event.payload.target.id}`,
        definitionId: FIXTURE_POISON_STATUS,
        sourceId: instanceId,
        stacks: 1,
        maxStacks: 3,
        duration: { scope: "round", remaining: 2 },
        tags: ["poison", "debuff"],
        data: null
      }
    }];
  },
  [FIXTURE_KILL_BOUNTY]: ({ event, binding }) => {
    if (event.type !== "unit-defeated") return [];
    const data = dataRecord(binding.data);
    const instanceId = String(data.instanceId ?? binding.instanceId);
    return [{
      id: `fixture:bounty:${event.id}`,
      source: { kind: "trait", instanceId },
      causeId: event.id,
      batchId: event.batchId,
      tags: ["bounty"],
      type: "modify-resource",
      resource: "gold",
      operation: "add",
      value: Number(data.gold ?? 0),
      reason: "effect"
    }];
  },
  [FIXTURE_AOE_LIFESTEAL]: ({ event, binding }) => {
    if (
      event.type !== "damage-applied" ||
      event.payload.target.kind !== "enemy" ||
      event.payload.applied <= 0
    ) {
      return [];
    }
    const data = dataRecord(binding.data);
    const instanceId = String(data.instanceId ?? binding.instanceId);
    const ownerId = String(data.ownerId) as CharacterId;
    return [{
      id: `fixture:lifesteal:${event.id}`,
      source: { kind: "equipment", instanceId },
      causeId: event.id,
      batchId: event.batchId,
      tags: ["lifesteal"],
      type: "heal",
      target: { kind: "party-member", id: ownerId },
      amount: Number(data.healing ?? 1)
    }];
  }
};

export function fixtureEquipment(
  definitionId: string,
  ownerId: CharacterId = "kael",
  data: JsonValue = null
): EquipmentInstance {
  return {
    kind: "equipment",
    instanceId: `equipment:${definitionId}`,
    definitionId,
    sourceId: ownerId,
    ownerId,
    slot: "test",
    durability: 3,
    maxDurability: 3,
    tags: ["fixture"],
    data
  };
}

export function fixtureTrait(
  definitionId: string,
  ownerId: CharacterId = "kael",
  data: JsonValue = null
): TraitInstance {
  return {
    kind: "trait",
    instanceId: `trait:${definitionId}`,
    definitionId,
    sourceId: ownerId,
    ownerId,
    tags: ["fixture"],
    data
  };
}
