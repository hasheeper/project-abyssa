import { describe, expect, it } from "vitest";
import {
  advanceStatusDurations,
  dispatchBattleCommand,
  getRoundOutcome,
  isEnemyDefeated,
  resolveAtomicEffects,
  resolveEffectsCommand,
  type AtomicEffect,
  type BattleEvent,
  type BattleEventPayloadMap,
  type EffectModifier,
  type ExpeditionState,
  type ReactionBinding,
  type ReactionRegistry
} from "../engine";
import { actScenario } from "../testing/scenario";

const systemSource = { kind: "system" as const, id: "test" };

function baseEffect(id: string) {
  return {
    id,
    source: systemSource,
    causeId: "test-command",
    batchId: "test-batch",
    tags: [] as string[]
  };
}

function damage(id: string, enemyId: string, amount: number): AtomicEffect {
  return {
    ...baseEffect(id),
    type: "damage",
    target: { kind: "enemy", id: enemyId },
    amount
  };
}

function eventPayloads<TType extends BattleEvent["type"]>(
  events: BattleEvent[],
  type: TType
): BattleEventPayloadMap[TType][] {
  return events.flatMap((event) =>
    event.type === type ? [event.payload as BattleEventPayloadMap[TType]] : []
  );
}

function withEnemyHp(state: ExpeditionState, hp: number): ExpeditionState {
  const next = structuredClone(state);
  next.enemies[0]!.hp = hp;
  next.enemies[0]!.maxHp = hp;
  return next;
}

describe("atomic effect resolver", () => {
  it("applies modifiers in priority, source and instance order", () => {
    const state = withEnemyHp(actScenario(501).build(), 20);
    const enemyId = state.enemies[0]!.id;
    const modifiers: EffectModifier[] = [
      {
        instanceId: "multiply",
        definitionId: "multiply",
        sourceId: "z",
        priority: 20,
        window: "before-damage",
        operation: "multiply",
        value: 2,
        requiredTags: [],
        targetKinds: []
      },
      {
        instanceId: "reduce",
        definitionId: "reduce",
        sourceId: "m",
        priority: 10,
        window: "before-damage",
        operation: "reduce",
        value: 3,
        requiredTags: [],
        targetKinds: []
      },
      {
        instanceId: "add",
        definitionId: "add",
        sourceId: "a",
        priority: 0,
        window: "before-damage",
        operation: "add",
        value: 2,
        requiredTags: [],
        targetKinds: []
      }
    ];

    const result = resolveAtomicEffects(state, [damage("hit", enemyId, 4)], {
      modifiers
    });
    expect(result.error).toBeNull();
    expect(result.state.enemies[0]!.hp).toBe(14);
    expect(eventPayloads(result.events, "modifier-applied").map((item) => item.modifierId)).toEqual([
      "add",
      "reduce",
      "multiply"
    ]);
    expect(eventPayloads(result.events, "damage-applied")[0]).toMatchObject({
      raw: 4,
      modified: 6,
      applied: 6
    });
  });

  it("supports penetration, redirection and prevention without unstable ordering", () => {
    const state = withEnemyHp(actScenario(503).build(), 20);
    state.enemies[1]!.hp = 20;
    state.enemies[1]!.maxHp = 20;
    const firstId = state.enemies[0]!.id;
    const secondId = state.enemies[1]!.id;
    const modifiers: EffectModifier[] = [
      {
        instanceId: "redirect",
        definitionId: "redirect",
        sourceId: "a",
        priority: 0,
        window: "before-damage",
        operation: "redirect",
        value: 0,
        requiredTags: ["redirectable"],
        targetKinds: ["enemy"],
        redirectTarget: { kind: "enemy", id: secondId }
      },
      {
        instanceId: "pierce",
        definitionId: "pierce",
        sourceId: "b",
        priority: 1,
        window: "before-damage",
        operation: "pierce",
        value: 2,
        requiredTags: [],
        targetKinds: []
      },
      {
        instanceId: "armor",
        definitionId: "armor",
        sourceId: "c",
        priority: 2,
        window: "before-damage",
        operation: "reduce",
        value: 3,
        requiredTags: [],
        targetKinds: []
      }
    ];
    const hit = damage("redirected", firstId, 5);
    hit.tags.push("redirectable");
    const result = resolveAtomicEffects(state, [hit], { modifiers });

    expect(result.state.enemies[0]!.hp).toBe(20);
    expect(result.state.enemies[1]!.hp).toBe(16);
    expect(eventPayloads(result.events, "damage-applied")[0]).toMatchObject({
      target: { kind: "enemy", id: secondId },
      modified: 4
    });

    const prevented = resolveAtomicEffects(state, [damage("prevented", firstId, 5)], {
      modifiers: [
        {
          instanceId: "immune",
          definitionId: "immune",
          sourceId: "a",
          priority: 0,
          window: "before-damage",
          operation: "prevent",
          value: 0,
          requiredTags: [],
          targetKinds: []
        }
      ]
    });
    expect(prevented.state.enemies[0]!.hp).toBe(20);
  });

  it("resolves a multi-target batch independently and in declared order", () => {
    const state = actScenario(509).build();
    state.enemies[0]!.hp = 5;
    state.enemies[0]!.maxHp = 5;
    state.enemies[1]!.hp = 5;
    state.enemies[1]!.maxHp = 5;
    const effects = state.enemies.map((enemy, index) => ({
      ...damage(`aoe-${index}`, enemy.id, index + 1),
      batchId: "aoe"
    }));
    const result = resolveAtomicEffects(state, effects);
    const hits = result.events.filter((event) => event.type === "damage-applied");

    expect(result.state.enemies.map((enemy) => enemy.hp)).toEqual([4, 3]);
    expect(hits.map((event) => event.payload.target)).toEqual(
      state.enemies.map((enemy) => ({ kind: "enemy", id: enemy.id }))
    );
    expect(hits.every((event) => event.batchId === "aoe")).toBe(true);
  });

  it("stacks, refreshes, expires, cleanses and respects status immunity", () => {
    const state = actScenario(521).build();
    const target = { kind: "party-member" as const, id: "kael" as const };
    const poison = (id: string): AtomicEffect => ({
      ...baseEffect(id),
      type: "apply-status",
      target,
      refresh: "stack",
      status: {
        instanceId: "poison-1",
        definitionId: "poison",
        sourceId: "test",
        stacks: 1,
        maxStacks: 3,
        duration: { scope: "round", remaining: 2 },
        tags: ["debuff", "poison"],
        data: null
      }
    });
    const applied = resolveAtomicEffects(state, [poison("poison-a"), poison("poison-b")]);
    expect(applied.state.statuses).toMatchObject([
      { definitionId: "poison", stacks: 2, duration: { remaining: 2 } }
    ]);

    const ticked = advanceStatusDurations(applied.state, "round");
    expect(ticked.state.statuses[0]!.duration!.remaining).toBe(1);
    const expired = advanceStatusDurations(ticked.state, "round");
    expect(expired.state.statuses).toEqual([]);
    expect(eventPayloads(expired.events, "status-removed")[0]).toMatchObject({
      reason: "expired"
    });

    const wardAndPoison: AtomicEffect[] = [
      {
        ...baseEffect("ward"),
        type: "apply-status",
        target: { kind: "battle" },
        refresh: "replace",
        status: {
          instanceId: "ward-1",
          definitionId: "poison-immunity",
          sourceId: "test",
          stacks: 1,
          maxStacks: 1,
          duration: null,
          tags: ["immune:poison"],
          data: null
        }
      },
      poison("blocked-poison")
    ];
    const immune = resolveAtomicEffects(state, wardAndPoison);
    expect(immune.state.statuses.map((status) => status.definitionId)).toEqual([
      "poison-immunity"
    ]);
    const cleansed = resolveAtomicEffects(immune.state, [
      {
        ...baseEffect("cleanse"),
        type: "cleanse",
        target: { kind: "battle" },
        statusTags: ["immune:poison"]
      }
    ]);
    expect(cleansed.state.statuses).toEqual([]);
  });

  it("runs reactions exactly once in stable binding order", () => {
    const state = withEnemyHp(actScenario(523).build(), 20);
    const enemyId = state.enemies[0]!.id;
    const bindings: ReactionBinding[] = [
      {
        instanceId: "reaction-b",
        definitionId: "gain-b",
        sourceId: "z",
        priority: 0,
        eventTypes: ["damage-applied"],
        data: 2
      },
      {
        instanceId: "reaction-a",
        definitionId: "gain-a",
        sourceId: "a",
        priority: 0,
        eventTypes: ["damage-applied"],
        data: 1
      }
    ];
    const handler: ReactionRegistry[string] = ({ event, binding }) => [
      {
        ...baseEffect(`${binding.instanceId}:${event.id}`),
        source: { kind: "status", instanceId: binding.instanceId },
        type: "modify-resource",
        resource: "gold",
        operation: "add",
        value: Number(binding.data)
      }
    ];
    const result = resolveAtomicEffects(state, [damage("root", enemyId, 1)], {
      reactions: bindings,
      reactionRegistry: { "gain-a": handler, "gain-b": handler }
    });

    expect(result.error).toBeNull();
    expect(result.state.gold).toBe(3);
    expect(
      eventPayloads(result.events, "effect-applied").map((event) => event.effectId)
    ).toEqual([
      "root",
      expect.stringContaining("reaction-a"),
      expect.stringContaining("reaction-b")
    ]);
  });

  it("terminates recursive reactions at the configured depth", () => {
    const state = withEnemyHp(actScenario(541).build(), 1000);
    const enemyId = state.enemies[0]!.id;
    const binding: ReactionBinding = {
      instanceId: "loop",
      definitionId: "loop",
      sourceId: "loop",
      priority: 0,
      eventTypes: ["effect-applied"],
      data: null
    };
    const result = resolveAtomicEffects(state, [damage("root", enemyId, 1)], {
      reactions: [binding],
      reactionRegistry: {
        loop: ({ event }) => [damage(`loop:${event.id}`, enemyId, 1)]
      },
      maxDepth: 1
    });

    expect(result.error).toBe("trigger-depth-exceeded");
    expect(eventPayloads(result.events, "resolution-budget-exceeded")).toContainEqual({
      kind: "depth",
      limit: 1
    });
  });

  it("terminates at the event budget and remains deterministic", () => {
    const state = actScenario(547).build();
    const effects: AtomicEffect[] = Array.from({ length: 10 }, (_, index) => ({
      ...baseEffect(`gold-${index}`),
      type: "modify-resource",
      resource: "gold",
      operation: "add",
      value: 1
    }));
    const first = resolveAtomicEffects(state, effects, { maxEvents: 4 });
    const second = resolveAtomicEffects(state, effects, { maxEvents: 4 });

    expect(first).toEqual(second);
    expect(first.error).toBe("event-budget-exceeded");
    expect(first.events).toHaveLength(4);
    expect(first.events.at(-1)?.type).toBe("resolution-budget-exceeded");
  });

  it("centralizes downing, defeat, clear and revive lifecycle", () => {
    const state = actScenario(557).build();
    state.party[0]!.hp = 1;
    state.enemies[1]!.hp = 0;
    state.enemies[1]!.intent = null;
    state.enemies[0]!.hp = 1;
    const effects: AtomicEffect[] = [
      {
        ...baseEffect("down"),
        type: "damage",
        target: { kind: "party-member", id: "kael" },
        amount: 1
      },
      {
        ...baseEffect("revive"),
        type: "revive",
        target: { kind: "party-member", id: "kael" },
        hp: 2
      },
      damage("defeat", state.enemies[0]!.id, 1)
    ];
    const result = resolveAtomicEffects(state, effects);

    expect(result.state.party[0]).toMatchObject({ hp: 2, downed: false, rustLevel: 1 });
    expect(result.state.dice[0]).not.toHaveProperty("rustLevel");
    expect(result.state.enemies.every(isEnemyDefeated)).toBe(true);
    expect(getRoundOutcome(result.state)).toBe("layer-cleared");
    expect(eventPayloads(result.events, "unit-downed")).toEqual([{ targetId: "kael" }]);
    expect(eventPayloads(result.events, "unit-revived")).toEqual([
      { targetId: "kael", hp: 2 }
    ]);
    expect(eventPayloads(result.events, "layer-cleared")).toHaveLength(1);
  });

  it("supports die, intent, unit, resource and encounter primitives", () => {
    const state = actScenario(563).build();
    const sourceEnemy = state.enemies[0]!;
    const spawned = {
      ...structuredClone(sourceEnemy),
      id: "fixture-spawn",
      hp: 2,
      maxHp: 2,
      intent: null
    };
    const effects: AtomicEffect[] = [
      {
        ...baseEffect("die"),
        type: "modify-die",
        ownerId: "kael",
        patch: { loaded: true }
      },
      {
        ...baseEffect("rust"),
        type: "modify-party-member",
        targetId: "kael",
        patch: { rustLevel: 1 }
      },
      {
        ...baseEffect("intent"),
        type: "modify-intent",
        enemyId: sourceEnemy.id,
        operation: "cancel"
      },
      { ...baseEffect("spawn"), type: "spawn-unit", unit: spawned },
      {
        ...baseEffect("resource"),
        type: "modify-resource",
        resource: "gold",
        operation: "add",
        value: 7
      },
      {
        ...baseEffect("rule"),
        type: "apply-encounter-rule",
        rule: {
          instanceId: "fog-1",
          definitionId: "fog",
          sourceId: "encounter",
          targetKey: "battle",
          stacks: 1,
          maxStacks: 1,
          duration: { scope: "layer", remaining: 1 },
          tags: ["fog"],
          data: null
        }
      },
      {
        ...baseEffect("despawn"),
        type: "despawn-unit",
        enemyId: "fixture-spawn",
        reason: "effect"
      },
      {
        ...baseEffect("remove-rule"),
        type: "remove-encounter-rule",
        instanceId: "fog-1"
      }
    ];
    const result = resolveAtomicEffects(state, effects);

    expect(result.error).toBeNull();
    expect(result.state.dice[0]).toMatchObject({ loaded: true });
    expect(result.state.dice[0]).not.toHaveProperty("rustLevel");
    expect(result.state.party[0]!.rustLevel).toBe(1);
    expect(result.state.enemies[0]!.intent).toBeNull();
    expect(
      isEnemyDefeated(
        result.state.enemies.find((enemy) => enemy.id === "fixture-spawn")!
      )
    ).toBe(true);
    expect(result.state.gold).toBe(7);
    expect(result.state.encounterRules).toEqual([]);
  });

  it("stores an entire reaction chain in one undo checkpoint", () => {
    const state = withEnemyHp(actScenario(569).build(), 10);
    const enemyId = state.enemies[0]!.id;
    const binding: ReactionBinding = {
      instanceId: "loot-on-hit",
      definitionId: "loot-on-hit",
      sourceId: "fixture",
      priority: 0,
      eventTypes: ["damage-applied"],
      data: null
    };
    const resolved = resolveEffectsCommand(state, "fixture command", [damage("hit", enemyId, 2)], {
      reactions: [binding],
      reactionRegistry: {
        "loot-on-hit": ({ event }) => [
          {
            ...baseEffect(`loot:${event.id}`),
            type: "modify-resource",
            resource: "gold",
            operation: "add",
            value: 5
          }
        ]
      }
    });
    expect(resolved.state.undoStack).toHaveLength(state.undoStack.length + 1);
    expect(resolved.state.gold).toBe(state.gold + 5);
    expect(resolved.state.enemies[0]!.hp).toBe(8);

    const undone = dispatchBattleCommand(resolved.state, { type: "undo" });
    expect(undone.error).toBeNull();
    expect(undone.state.gold).toBe(state.gold);
    expect(undone.state.enemies[0]!.hp).toBe(10);
    expect(undone.state.rng).toEqual(state.rng);
  });
});
