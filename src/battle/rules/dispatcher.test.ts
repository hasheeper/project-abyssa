import { describe, expect, it } from "vitest";
import {
  dispatchBattleCommand,
  getRoundOutcome,
  isEnemyDefeated,
  mulberry32,
  type BattleEvent
} from "../engine";
import { actScenario, ExpeditionScenarioBuilder } from "../testing/scenario";

function eventOf<TType extends BattleEvent["type"]>(
  events: BattleEvent[],
  type: TType
): Extract<BattleEvent, { type: TType }> {
  const event = events.find(
    (candidate): candidate is Extract<BattleEvent, { type: TType }> =>
      candidate.type === type
  );
  if (!event) throw new Error(`Missing event: ${type}`);
  return event;
}

describe("battle command dispatcher", () => {
  it("emits explicit damage, defeat, bounty and clear facts for an attack", () => {
    const builder = actScenario(101)
      .face("eustice", { verb: "attack", power: 3 }, true)
      .enemy(0, { hp: 2, maxHp: 2 })
      .enemy(1, { hp: 0, intent: null });
    const state = builder.build();
    const original = structuredClone(state);
    const enemyId = builder.enemyId(0);

    const transition = dispatchBattleCommand(state, {
      type: "attack-enemy",
      actorId: "eustice",
      enemyId
    });

    expect(transition.error).toBeNull();
    expect(state).toEqual(original);
    expect(transition.state.enemies[0]).toMatchObject({ hp: 0, intent: null });
    expect(isEnemyDefeated(transition.state.enemies[0]!)).toBe(true);
    expect(transition.state.dice.find((die) => die.ownerId === "eustice")?.spent)
      .toBe(true);
    expect(eventOf(transition.events, "damage-applied").payload).toMatchObject({
      target: { kind: "enemy", id: enemyId },
      raw: 3,
      modified: 3,
      applied: 2,
      hpBefore: 2,
      hpAfter: 0,
      lethal: true
    });
    expect(eventOf(transition.events, "unit-defeated").payload.reward).toBe(
      transition.state.gold - state.gold
    );
    expect(eventOf(transition.events, "resource-changed").payload.reason).toBe("bounty");
    expect(eventOf(transition.events, "layer-cleared").payload.settlement).toBeNull();
  });

  it("reports the protected teammate and exact shield change", () => {
    const builder = actScenario(103)
      .face("kael", { verb: "guard", power: 1 }, true)
      .enemy(0, {
        intent: {
          type: "attack",
          targetId: "elora",
          value: 2,
          title: "攻击",
          description: "造成 2 点伤害"
        },
        blocked: 0
      });
    const state = builder.build();
    const enemyId = builder.enemyId(0);
    const transition = dispatchBattleCommand(state, {
      type: "block-intent",
      actorId: "kael",
      enemyId
    });

    expect(transition.error).toBeNull();
    expect(transition.state.enemies[0]!.blocked).toBe(1);
    expect(transition.state.party.find((member) => member.id === "elora")?.shield)
      .toBe(1);
    expect(eventOf(transition.events, "guard-applied").payload).toEqual({
      actorId: "kael",
      protectedId: "elora",
      enemyId,
      amount: 1,
      blockedBefore: 0,
      blockedAfter: 1,
      shieldBefore: 0,
      shieldAfter: 1
    });
    expect(eventOf(transition.events, "die-spent").payload).toEqual({
      ownerId: "kael"
    });
  });

  it("reports actual healing and actual expensive-material cost", () => {
    const state = actScenario(107)
      .face("elora", { label: "越限奇迹" }, true)
      .party("kael", { hp: 2 })
      .state({ gold: 4 })
      .build();

    const transition = dispatchBattleCommand(state, {
      type: "heal-member",
      actorId: "elora",
      targetId: "kael"
    });

    expect(transition.error).toBeNull();
    expect(transition.state.party.find((member) => member.id === "kael")?.hp).toBe(3);
    expect(transition.state.gold).toBe(0);
    expect(eventOf(transition.events, "healing-applied").payload).toEqual({
      actorId: "elora",
      targetId: "kael",
      requested: 2,
      applied: 1,
      hpBefore: 2,
      hpAfter: 3,
      cost: 4
    });
    expect(eventOf(transition.events, "resource-changed").payload).toMatchObject({
      before: 4,
      after: 0,
      delta: -4,
      reason: "healing-cost"
    });
  });

  it("keeps random steal deterministic while exposing the gold delta", () => {
    const builder = actScenario(109).face("norma", { verb: "coin", power: 2 }, true);
    const state = builder.build();
    const enemyId = builder.enemyId(0);
    const transition = dispatchBattleCommand(
      state,
      { type: "steal-from", actorId: "norma", enemyId },
      { rng: mulberry32(991) }
    );

    expect(transition.error).toBeNull();
    expect(transition.state.gold).toBe(state.gold + 10);
    expect(eventOf(transition.events, "resource-changed").payload).toMatchObject({
      delta: 10,
      reason: "steal"
    });
  });

  it("resolves the whole enemy turn in stable event order", () => {
    const state = actScenario(113).build();
    const original = structuredClone(state);
    const transition = dispatchBattleCommand(
      state,
      { type: "end-turn" },
      { rng: mulberry32(997) }
    );

    expect(transition.error).toBeNull();
    expect(state).toEqual(original);
    expect(transition.events[0]?.type).toBe("hand-evaluated");
    expect(transition.events[1]?.type).toBe("enemy-turn-prepared");
    expect(eventOf(transition.events, "round-resolved").payload.outcome).toBe(
      getRoundOutcome(transition.state)
    );
    expect(transition.events.map((event) => event.sequence)).toEqual(
      transition.events.map((_, index) => index)
    );
    expect(new Set(transition.events.map((event) => event.id)).size).toBe(
      transition.events.length
    );
    expect(
      transition.events.every(
        (event) => event.source && event.causeId !== null && event.batchId !== null
      )
    ).toBe(true);
    expect(JSON.parse(JSON.stringify(transition.events))).toEqual(transition.events);
  });

  it("adapts roll, load and reroll without mutating command input", () => {
    const initial = ExpeditionScenarioBuilder.roll(127).build();
    const snapshot = structuredClone(initial);
    const rolled = dispatchBattleCommand(initial, { type: "roll-dice" }, { rng: () => 0 });

    expect(rolled.error).toBeNull();
    expect(initial).toEqual(snapshot);
    expect(eventOf(rolled.events, "dice-rolled").payload.results).toHaveLength(5);

    const loaded = dispatchBattleCommand(rolled.state, { type: "toggle-load", dieIndex: 0 });
    expect(eventOf(loaded.events, "die-load-changed").payload.loaded).toBe(true);

    const rerolled = dispatchBattleCommand(
      loaded.state,
      { type: "reroll-dice" },
      { rng: () => 0.5 }
    );
    expect(eventOf(rerolled.events, "dice-rolled").payload.roll).toBe("reroll");
    expect(rerolled.state.dice[0]?.faceIndex).toBe(0);
  });

  it("uses serialized RNG by default and returns typed failures without consuming it", () => {
    const state = actScenario(131)
      .face("norma", { verb: "coin" }, true)
      .build();
    const command = {
      type: "steal-from" as const,
      actorId: "norma" as const,
      enemyId: state.enemies[0]!.id
    };
    const first = dispatchBattleCommand(state, command);
    const second = dispatchBattleCommand(state, command);

    expect(first).toEqual(second);
    expect(first.error).toBeNull();
    expect(first.state.rng.flavor.cursor).toBe(state.rng.flavor.cursor + 1);

    expect(dispatchBattleCommand(state, { type: "next-round" }, { rng: () => 0 })).toEqual({
      state,
      events: [],
      error: "command-not-available"
    });
  });
});
