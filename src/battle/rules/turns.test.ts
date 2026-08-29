import { describe, expect, it } from "vitest";
import type { EnemyState, ExpeditionState } from "../domain/state";
import { mulberry32 } from "../persistence/rng";
import {
  getRoundOutcome,
  isEnemyDefeated
} from "../selectors/battle-selectors";
import { actScenario } from "../testing/scenario";
import { settleEnemyTurnTransition } from "./settlement";
import { isEnemyFrenzied } from "./frenzy-status";
import {
  activateScheduledFrenzyForNextRoundTransition,
  applyFrenzyRecoilTransition,
  completeNextRoundAfterFrenzyTransition,
  prepareEnemyTurnTransition
} from "./turns";

function loneEnemy(kind: EnemyState["kind"]): EnemyState {
  return {
    id: `stall-${kind}`,
    kind,
    name: "残局测试敌人",
    art: "sentinel",
    hp: 2,
    maxHp: 10,
    attack: 1,
    chargeReady: false,
    countdown: 2,
    intent:
      kind === "summoner"
        ? { type: "summon", title: "召唤", description: "" }
        : {
            type: "attack",
            targetId: "kael",
            value: 1,
            title: "攻击",
            description: ""
          },
    blocked: 0
  };
}

function stallingState(kind: EnemyState["kind"], seed: number): ExpeditionState {
  return actScenario(seed)
    .face("kororo", { verb: "attack", power: 4 }, true)
    .patch((state) => {
      state.layerStartEnemies = 3;
      state.enemies = [loneEnemy(kind)];
      state.gold = 200;
      state.lastEnemyHp = 0;
      state.stalledRounds = 0;
    })
    .build();
}

describe("native turn lifecycle", () => {
  it("prepares frenzy warning and intelligent fleeing without mutating input", () => {
    for (const [kind, seed] of [
      ["brute", 631],
      ["summoner", 633]
    ] as const) {
      const state = stallingState(kind, seed);
      const original = structuredClone(state);
      const native = prepareEnemyTurnTransition(state);

      expect(native.error).toBeNull();
      expect(state).toEqual(original);
      expect(native.events[0]?.type).toBe("hand-evaluated");
      expect(native.events[1]?.type).toBe("enemy-turn-prepared");
      if (kind === "brute") {
        expect(native.enemyOrder).toEqual(["stall-brute"]);
        expect(native.state.statuses).toContainEqual(
          expect.objectContaining({
            definitionId: "status.frenzy-warning",
            targetKey: "enemy:stall-brute",
            duration: { scope: "round", remaining: 3 }
          })
        );
      } else {
        expect(native.enemyOrder).toEqual([]);
        expect(native.state.enemies[0]).toMatchObject({ hp: 0 });
        expect(isEnemyDefeated(native.state.enemies[0]!)).toBe(true);
        expect(native.state.gold).toBe(100);
        expect(native.state.statuses).toEqual([]);
      }
    }
  });

  it("keeps frenzy self-destruction rewardless", () => {
    const prepared = prepareEnemyTurnTransition(stallingState("brute", 635)).state;
    const enemy = prepared.enemies[0]!;
    prepared.statuses = [{
      kind: "status",
      instanceId: `frenzy-active:${enemy.id}`,
      definitionId: "status.frenzy-active",
      sourceId: enemy.id,
      targetKey: `enemy:${enemy.id}`,
      stacks: 1,
      maxStacks: 1,
      duration: null,
      tags: ["frenzy", "persistent", "unremovable"],
      data: { enemyId: enemy.id }
    }];
    enemy.hp = 1;
    enemy.intent = null;
    prepared.mode = {
      type: "enemy-turn",
      enemyOrder: [],
      cursor: 0,
      closingHand: null,
      outcome: null
    };
    prepared.gold = 0;

    const recoil = applyFrenzyRecoilTransition(prepared);
    expect(recoil.error).toBeNull();
    const settled = settleEnemyTurnTransition(recoil.state, mulberry32(637), null);

    expect(settled.error).toBeNull();
    expect(getRoundOutcome(settled.state)).toBe("layer-cleared");
    expect(recoil.events.some((event) => event.type === "damage-applied")).toBe(true);
    expect(
      recoil.events.find((event) => event.type === "unit-defeated")?.payload.reward
    ).toBe(0);
  });

  it("activates scheduled frenzy and applies the attack bonus once", () => {
    const state = prepareEnemyTurnTransition(stallingState("brute", 639)).state;
    const enemy = state.enemies[0]!;
    state.round = 3;
    const warning = state.statuses.find(
      (status) => status.definitionId === "status.frenzy-warning"
    )!;
    warning.duration = { scope: "round", remaining: 1 };
    enemy.attack = 1;
    enemy.intent = null;
    state.mode = {
      type: "enemy-turn",
      enemyOrder: [],
      cursor: 0,
      closingHand: null,
      outcome: null
    };

    const activation = activateScheduledFrenzyForNextRoundTransition(state);
    expect(activation.error).toBeNull();
    const next = completeNextRoundAfterFrenzyTransition(
      activation.state,
      mulberry32(641)
    );
    expect(next.error).toBeNull();
    const native = next.state;

    expect(native.enemies[0]).toMatchObject({
      attack: 4
    });
    expect(isEnemyFrenzied(native, native.enemies[0]!)).toBe(true);
    expect(native.statuses).toContainEqual(
      expect.objectContaining({
        definitionId: "status.frenzy-active",
        targetKey: "enemy:stall-brute",
        duration: null
      })
    );
    expect(
      activation.events.filter(
        (event) => event.type === "stat-modified" && event.payload.stat === "attack"
      )
    ).toHaveLength(1);
  });

  it("counts the frenzy warning as a round status and keeps frenzy until death", () => {
    const prepared = prepareEnemyTurnTransition(stallingState("brute", 643));
    expect(prepared.error).toBeNull();
    let state = prepared.state;
    state.mode = {
      type: "enemy-turn",
      enemyOrder: [],
      cursor: 0,
      closingHand: null,
      outcome: null
    };
    state.enemies[0]!.intent = null;

    const first = activateScheduledFrenzyForNextRoundTransition(state);
    expect(first.state.statuses[0]?.duration?.remaining).toBe(2);
    expect(isEnemyFrenzied(first.state, first.state.enemies[0]!)).toBe(false);
    const second = activateScheduledFrenzyForNextRoundTransition(first.state);
    expect(second.state.statuses[0]?.duration?.remaining).toBe(1);
    expect(isEnemyFrenzied(second.state, second.state.enemies[0]!)).toBe(false);
    const activated = activateScheduledFrenzyForNextRoundTransition(second.state);
    expect(activated.state.statuses).toContainEqual(
      expect.objectContaining({
        definitionId: "status.frenzy-active",
        duration: null
      })
    );
    expect(isEnemyFrenzied(activated.state, activated.state.enemies[0]!)).toBe(true);

    activated.state.enemies[0]!.hp = 1;
    const defeated = applyFrenzyRecoilTransition(activated.state);
    expect(isEnemyDefeated(defeated.state.enemies[0]!)).toBe(true);
    expect(defeated.state.statuses).toEqual([]);
    expect(
      defeated.events.some(
        (event) =>
          event.type === "status-removed" &&
          event.payload.definitionId === "status.frenzy-active"
      )
    ).toBe(true);
  });
});
