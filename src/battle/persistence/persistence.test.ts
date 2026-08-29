import { describe, expect, it } from "vitest";
import {
  createBattleSaveDto,
  createExpeditionFromSeed,
  deserializeBattleState,
  dispatchBattleCommand,
  migrateBattleSaveDto,
  serializeBattleState,
  type BattleEvent,
  type ExpeditionState
} from "../engine";
import { actScenario } from "../testing/scenario";

function finishPreparedTurn(initial: ExpeditionState): {
  state: ExpeditionState;
  events: BattleEvent[];
} {
  let state = initial;
  const events: BattleEvent[] = [];
  while (
    state.mode.type === "enemy-turn" &&
    state.mode.cursor < state.mode.enemyOrder.length
  ) {
    const transition = dispatchBattleCommand(state, { type: "resolve-next-enemy" });
    expect(transition.error).toBeNull();
    state = transition.state;
    events.push(...transition.events);
  }
  const finished = dispatchBattleCommand(state, { type: "finish-enemy-turn" });
  expect(finished.error).toBeNull();
  events.push(...finished.events);
  return { state: finished.state, events };
}

function visibleRuleState(state: ExpeditionState) {
  const { eventSequence: _eventSequence, undoStack: _undoStack, ...visible } = state;
  return visible;
}

describe("Battle persistence and deterministic runtime", () => {
  it("serializes in the middle of an enemy turn and resumes identically", () => {
    let state = createExpeditionFromSeed(401);
    state = dispatchBattleCommand(state, { type: "roll-dice" }).state;
    state = dispatchBattleCommand(state, { type: "begin-enemy-turn" }).state;
    const firstStep = dispatchBattleCommand(state, { type: "resolve-next-enemy" });
    expect(firstStep.error).toBeNull();
    expect(firstStep.state.mode).toMatchObject({ type: "enemy-turn", cursor: 1 });

    const restored = deserializeBattleState(serializeBattleState(firstStep.state));
    expect(restored).toEqual(firstStep.state);

    const uninterrupted = finishPreparedTurn(firstStep.state);
    const resumed = finishPreparedTurn(restored);
    expect(resumed).toEqual(uninterrupted);
  });

  it("keeps combat, loot and flavor RNG streams isolated", () => {
    const state = actScenario(409)
      .face("norma", { verb: "coin" }, true)
      .build();
    const before = structuredClone(state.rng);
    const stolen = dispatchBattleCommand(state, {
      type: "steal-from",
      actorId: "norma",
      enemyId: state.enemies[0]!.id
    });

    expect(stolen.error).toBeNull();
    expect(stolen.state.rng.combat).toEqual(before.combat);
    expect(stolen.state.rng.loot).toEqual(before.loot);
    expect(stolen.state.rng.flavor.cursor).toBe(before.flavor.cursor + 1);
  });

  it("restores RNG in a complete checkpoint before redoing a random action", () => {
    const state = actScenario(419)
      .face("norma", { verb: "coin" }, true)
      .build();
    const command = {
      type: "steal-from" as const,
      actorId: "norma" as const,
      enemyId: state.enemies[0]!.id
    };
    const first = dispatchBattleCommand(state, command);
    const undone = dispatchBattleCommand(first.state, { type: "undo" });
    const redone = dispatchBattleCommand(undone.state, command);

    expect(undone.error).toBeNull();
    expect(undone.state.rng).toEqual(state.rng);
    expect(redone.error).toBeNull();
    expect(redone.state.rng).toEqual(first.state.rng);
    expect(visibleRuleState(redone.state)).toEqual(visibleRuleState(first.state));
    expect(
      redone.events.find((event) => event.type === "resource-changed")?.payload
    ).toEqual(first.events.find((event) => event.type === "resource-changed")?.payload);
  });

  it("validates current saves and rejects illegal runtime state", () => {
    const state = createExpeditionFromSeed(421);
    expect(migrateBattleSaveDto(createBattleSaveDto(state)).state).toEqual(state);

    const broken = createBattleSaveDto(state);
    broken.state.rng.combat.cursor = -1;
    expect(() => migrateBattleSaveDto(broken)).toThrow("rng.stream");
  });

  it("migrates the schema-v1 state shape and drops unsafe partial undo entries", () => {
    const current = dispatchBattleCommand(createExpeditionFromSeed(431), {
      type: "roll-dice"
    }).state;
    const legacy = structuredClone(current) as unknown as Record<string, unknown>;
    delete legacy.mode;
    delete legacy.rng;
    delete legacy.pendingEffects;
    delete legacy.pendingReactions;
    delete legacy.eventSequence;
    legacy.phase = "act";
    legacy.status = "active";
    legacy.lastOutcome = null;
    legacy.undoStack = [{ action: "partial-v1-entry" }];

    const migrated = migrateBattleSaveDto({
      schemaVersion: 1,
      rulesVersion: 1,
      contentVersion: 1,
      state: legacy
    });
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.state.mode).toEqual({ type: "player-turn" });
    expect(migrated.state.undoStack).toEqual([]);
    expect(migrated.state.loadout).toEqual({ items: [], equipment: [], traits: [] });
  });

  it("migrates schema-2 saves with an empty loadout snapshot", () => {
    const state = createExpeditionFromSeed(433);
    const legacy = structuredClone(state) as unknown as Record<string, unknown>;
    delete legacy.loadoutAtStart;
    delete legacy.loadout;

    const migrated = migrateBattleSaveDto({
      schemaVersion: 2,
      rulesVersion: 1,
      contentVersion: 1,
      state: legacy
    });

    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.state.loadoutAtStart).toEqual({
      items: [],
      equipment: [],
      traits: []
    });
    expect(migrated.state.loadout).toEqual(migrated.state.loadoutAtStart);
    expect(migrated.state.loadout).not.toBe(migrated.state.loadoutAtStart);
  });

  it("migrates schema-3 mirrors, including nested undo checkpoints", () => {
    const rolled = dispatchBattleCommand(createExpeditionFromSeed(439), {
      type: "roll-dice"
    }).state;
    const current = dispatchBattleCommand(rolled, {
      type: "toggle-load",
      dieIndex: 0
    }).state;
    const legacy = structuredClone(current) as unknown as Record<string, unknown>;

    const addMirrors = (value: Record<string, unknown>) => {
      const mode = value.mode as { type?: string } | undefined;
      value.phase = mode?.type === "awaiting-roll" ? "roll" : mode?.type === "player-turn" ? "act" : "enemy";
      value.status = mode?.type === "greed" ? "greed" : mode?.type === "finished" ? "finished" : "active";
      value.lastOutcome = null;
      const party = value.party as Array<{ id: string; downed: boolean; rustLevel: number }>;
      for (const die of value.dice as Array<Record<string, unknown>>) {
        const owner = party.find((member) => member.id === die.ownerId)!;
        die.downed = owner.downed;
        die.rustLevel = owner.rustLevel;
      }
      for (const enemy of value.enemies as Array<Record<string, unknown>>) {
        enemy.dead = typeof enemy.hp === "number" && enemy.hp <= 0;
      }
    };

    addMirrors(legacy);
    const checkpoint = (
      legacy.undoStack as Array<{ state: Record<string, unknown> }>
    )[0]!.state;
    addMirrors(checkpoint);
    const firstEnemy = (legacy.enemies as Array<Record<string, unknown>>)[0]!;
    firstEnemy.dead = true;
    firstEnemy.hp = 2;
    firstEnemy.intent = null;

    const migrated = migrateBattleSaveDto({
      schemaVersion: 3,
      rulesVersion: 1,
      contentVersion: 1,
      state: legacy
    });

    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.state.enemies[0]).toMatchObject({ hp: 0, intent: null });
    expect(migrated.state.enemies[0]).not.toHaveProperty("dead");
    expect(migrated.state.dice[0]).not.toHaveProperty("downed");
    expect(migrated.state.dice[0]).not.toHaveProperty("rustLevel");
    expect(migrated.state).not.toHaveProperty("phase");
    expect(migrated.state.undoStack[0]!.state).not.toHaveProperty("status");
    expect(migrated.state.undoStack[0]!.state.dice[0]).not.toHaveProperty(
      "rustLevel"
    );
  });
});
