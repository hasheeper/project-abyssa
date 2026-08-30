import { describe, expect, it } from "vitest";
import type {
  AtomicEffect,
  AtomicEffectBase,
  EffectModifier
} from "../domain/effects";
import type {
  BattleLoadoutSnapshot,
  ExpeditionState,
  ItemInstance
} from "../domain/state";
import {
  FIXTURE_AOE_LIFESTEAL,
  FIXTURE_EFFECT_DEFINITIONS,
  FIXTURE_KILL_BOUNTY,
  FIXTURE_POISON_ON_HIT,
  FIXTURE_POISON_STATUS,
  FIXTURE_REACTION_REGISTRY,
  FIXTURE_TAGGED_SPECIALIST,
  fixtureEquipment,
  fixtureTrait
} from "../testing/effect-fixtures";
import { actScenario } from "../testing/scenario";
import { dispatchBattleCommand } from "./dispatcher";
import { createExpeditionStateFromInput } from "./expedition";
import { createBattleLoadoutSettlement } from "./loadout";
import { mulberry32 } from "../persistence/rng";
import { resolveAtomicEffects, resolveEffectsCommand } from "./resolver";

function base(id: string, tags: string[] = []): AtomicEffectBase {
  return {
    id,
    source: { kind: "system", id: "fixture" },
    causeId: "fixture-root",
    batchId: "fixture-batch",
    tags
  };
}

function damage(
  id: string,
  enemyId: string,
  amount: number,
  tags: string[] = []
): Extract<AtomicEffect, { type: "damage" }> {
  return {
    ...base(id, tags),
    type: "damage",
    target: { kind: "enemy", id: enemyId },
    amount
  };
}

function withLoadout(
  state: ExpeditionState,
  loadout: BattleLoadoutSnapshot
): ExpeditionState {
  return {
    ...state,
    loadoutAtStart: structuredClone(loadout),
    loadout: structuredClone(loadout)
  };
}

const fixtureOptions = {
  effectDefinitions: FIXTURE_EFFECT_DEFINITIONS,
  reactionRegistry: FIXTURE_REACTION_REGISTRY
} as const;

describe("content compatibility seam", () => {
  it("clones the battle input loadout and preserves the opening snapshot", () => {
    const equipment = fixtureEquipment(FIXTURE_TAGGED_SPECIALIST);
    const loadout: BattleLoadoutSnapshot = {
      items: [],
      equipment: [equipment],
      traits: []
    };
    const state = createExpeditionStateFromInput(mulberry32(799), {
      location: "夹具领域",
      loadout
    });

    equipment.durability = 0;
    expect(state.location).toBe("夹具领域");
    expect(state.loadout.equipment[0]!.durability).toBe(3);
    expect(state.loadoutAtStart).toEqual(state.loadout);
    expect(state.loadoutAtStart).not.toBe(state.loadout);
  });

  it("composes target-tag specialization and on-hit poison from definitions", () => {
    const equipment = [
      fixtureEquipment(FIXTURE_TAGGED_SPECIALIST),
      fixtureEquipment(FIXTURE_POISON_ON_HIT)
    ];
    const state = withLoadout(actScenario(801).build(), {
      items: [],
      equipment,
      traits: []
    });
    const enemyId = state.enemies[0]!.id;
    state.enemies[0]!.hp = 10;
    state.enemies[0]!.maxHp = 10;

    const result = resolveAtomicEffects(
      state,
      [damage("tagged-hit", enemyId, 2, ["target:anomaly"])],
      fixtureOptions
    );

    expect(result.error).toBeNull();
    expect(result.state.enemies[0]!.hp).toBe(6);
    expect(result.events.find((event) => event.type === "modifier-applied")?.payload)
      .toMatchObject({ operation: "multiply", before: 2, after: 4 });
    expect(result.state.statuses).toContainEqual(
      expect.objectContaining({
        definitionId: FIXTURE_POISON_STATUS,
        targetKey: `enemy:${enemyId}`,
        stacks: 1
      })
    );
  });

  it("composes a kill reward without changing the damage action", () => {
    const trait = fixtureTrait(FIXTURE_KILL_BOUNTY);
    const state = withLoadout(actScenario(803).build(), {
      items: [],
      equipment: [],
      traits: [trait]
    });
    const enemyId = state.enemies[0]!.id;
    state.enemies[0]!.hp = 1;

    const result = resolveAtomicEffects(
      state,
      [{
        ...damage("lethal-hit", enemyId, 1),
        defeat: { reason: "effect", reward: 0 }
      }],
      fixtureOptions
    );

    expect(result.error).toBeNull();
    expect(result.state.gold).toBe(state.gold + 7);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "unit-defeated" }),
        expect.objectContaining({
          type: "resource-changed",
          payload: expect.objectContaining({ delta: 7, reason: "effect" })
        })
      ])
    );
  });

  it("resolves an AOE batch in order and lifesteals once per landed hit", () => {
    const equipment = fixtureEquipment(FIXTURE_AOE_LIFESTEAL, "kael", {
      ownerId: "kael",
      healing: 1
    });
    const state = withLoadout(
      actScenario(805).party("kael", { hp: 1 }).build(),
      { items: [], equipment: [equipment], traits: [] }
    );
    state.enemies.forEach((enemy) => {
      enemy.hp = 5;
      enemy.maxHp = 5;
    });
    const effects = state.enemies.map((enemy, index) =>
      damage(`aoe-${index}`, enemy.id, index + 1, ["aoe"])
    );

    const result = resolveAtomicEffects(state, effects, fixtureOptions);

    expect(result.error).toBeNull();
    expect(result.state.enemies.map((enemy) => enemy.hp)).toEqual([4, 3]);
    expect(result.state.party.find((member) => member.id === "kael")?.hp).toBe(3);
    expect(
      result.events.filter(
        (event) =>
          event.type === "healing-applied" && event.source.kind === "equipment"
      )
    ).toHaveLength(2);
  });

  it("supports cleanse, immunity, pierce, durability, consumption and atomic undo", () => {
    const item: ItemInstance = {
      kind: "item",
      instanceId: "item:test-tonic",
      definitionId: "fixture.tonic",
      sourceId: "kael",
      ownerId: "kael",
      charges: 2,
      maxCharges: 2,
      tags: ["fixture"],
      data: null
    };
    const equipment = fixtureEquipment(FIXTURE_TAGGED_SPECIALIST);
    equipment.durability = 2;
    equipment.maxDurability = 2;
    let state = withLoadout(actScenario(807).build(), {
      items: [item],
      equipment: [equipment],
      traits: []
    });
    const enemyId = state.enemies[0]!.id;
    const poison = (id: string): AtomicEffect => ({
      ...base(id),
      type: "apply-status",
      target: { kind: "enemy", id: enemyId },
      refresh: "stack",
      status: {
        instanceId: `poison:${id}`,
        definitionId: FIXTURE_POISON_STATUS,
        sourceId: "fixture",
        stacks: 1,
        maxStacks: 3,
        duration: { scope: "round", remaining: 2 },
        tags: ["poison", "debuff"],
        data: null
      }
    });
    const poisoned = resolveAtomicEffects(state, [poison("first")]);
    const cleansed = resolveAtomicEffects(poisoned.state, [{
      ...base("cleanse"),
      type: "cleanse",
      target: { kind: "enemy", id: enemyId },
      statusTags: ["poison"]
    }]);
    expect(cleansed.state.statuses).toEqual([]);

    const warded = resolveAtomicEffects(cleansed.state, [{
      ...base("ward"),
      type: "apply-status",
      target: { kind: "enemy", id: enemyId },
      refresh: "replace",
      status: {
        instanceId: "poison-immunity",
        definitionId: "fixture.poison-immunity",
        sourceId: "fixture",
        stacks: 1,
        maxStacks: 1,
        duration: { scope: "layer", remaining: 1 },
        tags: [`immune:${FIXTURE_POISON_STATUS}`],
        data: null
      }
    }]);
    const immune = resolveAtomicEffects(warded.state, [poison("blocked")]);
    expect(immune.state.statuses.map((status) => status.definitionId)).toEqual([
      "fixture.poison-immunity"
    ]);

    const modifiers: EffectModifier[] = [
      {
        instanceId: "pierce",
        definitionId: "fixture.pierce",
        sourceId: "a",
        priority: 0,
        window: "before-damage",
        operation: "pierce",
        value: 2,
        requiredTags: ["armored"],
        targetKinds: ["enemy"]
      },
      {
        instanceId: "armor",
        definitionId: "fixture.armor",
        sourceId: "b",
        priority: 1,
        window: "before-damage",
        operation: "reduce",
        value: 3,
        requiredTags: ["armored"],
        targetKinds: ["enemy"]
      }
    ];
    state.enemies[0]!.hp = 10;
    state.enemies[0]!.maxHp = 10;
    const pierced = resolveAtomicEffects(
      state,
      [damage("piercing-hit", enemyId, 5, ["armored"])],
      { modifiers }
    );
    expect(pierced.state.enemies[0]!.hp).toBe(6);

    const spent = resolveEffectsCommand(state, "consume fixtures", [
      {
        ...base("consume-item"),
        source: { kind: "item", instanceId: item.instanceId },
        type: "consume-item",
        instanceId: item.instanceId,
        amount: 1
      },
      {
        ...base("wear-equipment"),
        source: { kind: "equipment", instanceId: equipment.instanceId },
        type: "consume-equipment-durability",
        instanceId: equipment.instanceId,
        amount: 2
      }
    ]);
    expect(spent.error).toBeNull();
    expect(createBattleLoadoutSettlement(state.loadoutAtStart, spent.state.loadout))
      .toEqual({
        consumedItems: [{
          instanceId: item.instanceId,
          definitionId: item.definitionId,
          chargesSpent: 1,
          chargesRemaining: 1
        }],
        equipmentWear: [{
          instanceId: equipment.instanceId,
          definitionId: equipment.definitionId,
          durabilitySpent: 2,
          durabilityRemaining: 0,
          broken: true
        }]
      });
    expect(spent.events.some((event) => event.type === "item-consumed")).toBe(true);
    expect(
      spent.events.some((event) => event.type === "equipment-durability-changed")
    ).toBe(true);

    const brokenState = structuredClone(spent.state);
    brokenState.enemies[0]!.hp = 10;
    brokenState.enemies[0]!.maxHp = 10;
    const withoutBrokenModifier = resolveAtomicEffects(
      brokenState,
      [damage("broken-equipment-hit", enemyId, 2, ["target:anomaly"])],
      fixtureOptions
    );
    expect(withoutBrokenModifier.state.enemies[0]!.hp).toBe(8);
    expect(
      withoutBrokenModifier.events.some((event) => event.type === "modifier-applied")
    ).toBe(false);

    const undone = dispatchBattleCommand(spent.state, { type: "undo" });
    expect(undone.state.loadout).toEqual(state.loadout);
  });
});
