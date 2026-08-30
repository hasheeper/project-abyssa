import { describe, expect, it } from "vitest";
import type {
  CharacterId,
  EnemyIntent,
  EnemyKind,
  EnemyState,
  ExpeditionState
} from "../domain/state";
import { actScenario } from "../testing/scenario";
import { resolveEnemyIntentTransition } from "./enemy-intents";
import { prepareEnemyTurnTransition } from "./turns";

function enemy(
  id: string,
  kind: EnemyKind,
  intent: EnemyIntent,
  patch: Partial<EnemyState> = {}
): EnemyState {
  return {
    id,
    kind,
    name: `测试敌人-${id}`,
    art: "sentinel",
    hp: 20,
    maxHp: 20,
    attack: 1,
    chargeReady: false,
    countdown: 2,
    intent,
    blocked: 0,
    ...patch
  };
}

function preparedState(source: EnemyState, seed: number): ExpeditionState {
  const state = actScenario(seed)
    .patch((draft) => {
      draft.enemies = [source];
      draft.lastEnemyHp = 0;
      draft.stalledRounds = 0;
    })
    .build();
  const prepared = prepareEnemyTurnTransition(state);
  if (prepared.error) throw new Error("Could not prepare enemy fixture");
  return prepared.state;
}

function resolveFixture(state: ExpeditionState, enemyId: string) {
  const original = structuredClone(state);
  const native = resolveEnemyIntentTransition(state, enemyId);

  expect(native.error).toBeNull();
  expect(state).toEqual(original);
  expect(native.events.find((event) => event.type === "enemy-intent-resolved")?.payload)
    .toEqual(native.enemyEvent);
  return native;
}

describe("native enemy intents", () => {
  it("keeps hit, block, downing, rust and stale-target miss behavior explicit", () => {
    const targetId: CharacterId = "eustice";
    const intent: EnemyIntent = {
      type: "attack",
      targetId,
      value: 2,
      title: "攻击",
      description: ""
    };
    const hit = preparedState(enemy("hit", "brute", intent), 601);
    hit.party.find((member) => member.id === targetId)!.hp = 2;
    const hitResult = resolveFixture(hit, "hit");
    expect(hitResult.enemyEvent).toMatchObject({ result: "hit", damage: 2, lethal: true });
    expect(hitResult.state.party.find((member) => member.id === targetId)).toMatchObject({
      hp: 0,
      downed: true,
      rustLevel: 1
    });
    expect(hitResult.events.some((event) => event.type === "damage-applied")).toBe(true);
    expect(hitResult.events.some((event) => event.type === "unit-downed")).toBe(true);

    const blocked = preparedState(
      enemy("blocked", "brute", intent, { blocked: 2 }),
      603
    );
    const blockedResult = resolveFixture(blocked, "blocked");
    expect(blockedResult.enemyEvent).toMatchObject({ result: "blocked", damage: 0 });

    const miss = preparedState(enemy("miss", "brute", intent), 605);
    const target = miss.party.find((member) => member.id === targetId)!;
    target.hp = 0;
    target.downed = true;
    expect(resolveFixture(miss, "miss").enemyEvent).toMatchObject({
      result: "miss",
      damage: 0
    });
  });

  it("keeps charge and seal state changes equivalent", () => {
    const charging = preparedState(
      enemy("charge", "charger", {
        type: "charge",
        title: "蓄力",
        description: ""
      }),
      607
    );
    const charged = resolveFixture(charging, "charge");
    expect(charged.state.enemies[0]).toMatchObject({ chargeReady: true, intent: null });

    const sealing = preparedState(
      enemy("seal", "anomaly", {
        type: "seal",
        targetId: "kororo",
        title: "缠绕",
        description: ""
      }),
      609
    );
    const sealed = resolveFixture(sealing, "seal");
    expect(sealed.state.party.find((member) => member.id === "kororo")?.sealedNext)
      .toBe(true);
  });

  it("keeps countdown loss and defeat events equivalent", () => {
    const state = preparedState(
      enemy(
        "trap",
        "trap",
        { type: "countdown", title: "倒计时", description: "" },
        { countdown: 1 }
      ),
      611
    );
    state.gold = 37;
    const result = resolveFixture(state, "trap");
    expect(result.events.find((event) => event.type === "resource-changed")?.payload)
      .toMatchObject({ resource: "gold", before: 37, after: 27, reason: "enemy-effect" });
    expect(result.events.some((event) => event.type === "unit-defeated")).toBe(true);
  });

  it("keeps summon capacity, ids and frozen queue behavior equivalent", () => {
    const state = preparedState(
      enemy("summoner", "summoner", {
        type: "summon",
        title: "召唤",
        description: ""
      }),
      613
    );
    const orderBefore = [...state.mode.type === "enemy-turn" ? state.mode.enemyOrder : []];
    const result = resolveFixture(state, "summoner");
    expect(result.events.some((event) => event.type === "unit-spawned")).toBe(true);
    expect(result.state.mode.type === "enemy-turn" ? result.state.mode.enemyOrder : [])
      .toEqual(orderBefore);
  });
});
