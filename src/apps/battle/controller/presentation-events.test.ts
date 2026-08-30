import { describe, expect, it } from "vitest";
import { dispatchBattleCommand } from "../rules/dispatcher";
import { actScenario } from "../testing/scenario";
import {
  getEnemyTurnCue,
  getPlayerAttackCue,
  getPlayerSupportCue,
  groupPresentationEventsByBatch
} from "./presentation-events";
import { getPendingLayerClearEventId } from "./useExpeditionBattleController";

describe("event-to-presentation contract", () => {
  it("maps a die damage event to the player attack cue", () => {
    const builder = actScenario(701)
      .face("eustice", { verb: "attack", power: 3 }, true)
      .enemy(0, { hp: 2, maxHp: 2 });
    const enemyId = builder.enemyId(0);
    const result = dispatchBattleCommand(builder.build(), {
      type: "attack-enemy",
      actorId: "eustice",
      enemyId
    });

    expect(getPlayerAttackCue(result.events)).toEqual({
      actorId: "eustice",
      targetId: enemyId,
      damage: 3,
      lethal: true
    });
  });

  it("maps guard and healing facts to their support cues", () => {
    const guardBuilder = actScenario(703)
      .face("kael", { verb: "guard", power: 1 }, true)
      .enemy(0, {
        intent: {
          type: "attack",
          targetId: "elora",
          value: 2,
          title: "攻击",
          description: "造成 2 点伤害"
        }
      });
    const guardResult = dispatchBattleCommand(guardBuilder.build(), {
      type: "block-intent",
      actorId: "kael",
      enemyId: guardBuilder.enemyId(0)
    });
    expect(getPlayerSupportCue(guardResult.events)).toEqual({
      kind: "guard",
      actorId: "kael",
      targetId: "elora",
      amount: 1
    });

    const healingState = actScenario(705)
      .face("elora", { label: "越限奇迹" }, true)
      .party("kael", { hp: 2 })
      .build();
    const healingResult = dispatchBattleCommand(healingState, {
      type: "heal-member",
      actorId: "elora",
      targetId: "kael"
    });
    expect(getPlayerSupportCue(healingResult.events)).toEqual({
      kind: "heal",
      actorId: "elora",
      targetId: "kael",
      amount: 1
    });
  });

  it("maps the resolved enemy intent event without reconstructing its result", () => {
    const initial = actScenario(707)
      .enemy(0, {
        intent: {
          type: "attack",
          targetId: "norma",
          value: 1,
          title: "攻击",
          description: "造成 1 点伤害"
        }
      })
      .build();
    const prepared = dispatchBattleCommand(initial, { type: "begin-enemy-turn" });
    const resolved = dispatchBattleCommand(prepared.state, {
      type: "resolve-next-enemy"
    });
    const event = resolved.events.find(
      (candidate) => candidate.type === "enemy-intent-resolved"
    );

    expect(event?.type).toBe("enemy-intent-resolved");
    expect(getEnemyTurnCue(resolved.events)).toEqual(event?.payload);
    expect(getEnemyTurnCue(resolved.events)).toMatchObject({
      enemyId: initial.enemies[0]!.id,
      targetId: "norma"
    });
  });

  it("waits only for an unbanked layer-clear event", () => {
    const builder = actScenario(709)
      .face("eustice", { verb: "attack", power: 3 }, true)
      .enemy(0, { hp: 2, maxHp: 2 })
      .enemy(1, { hp: 0, intent: null });
    const cleared = dispatchBattleCommand(builder.build(), {
      type: "attack-enemy",
      actorId: "eustice",
      enemyId: builder.enemyId(0)
    });
    const unbankedClear = cleared.events.find(
      (event) => event.type === "layer-cleared" && event.payload.settlement === null
    );

    expect(getPendingLayerClearEventId(cleared)).toBe(unbankedClear?.id);

    const settled = dispatchBattleCommand(cleared.state, { type: "end-turn" });
    const bankedClear = settled.events.find(
      (event) => event.type === "layer-cleared" && event.payload.settlement !== null
    );
    expect(bankedClear).toBeDefined();
    expect(getPendingLayerClearEventId(settled)).toBeNull();
  });

  it("keeps domain order while grouping a shared AOE batch for simultaneous presentation", () => {
    const builder = actScenario(711)
      .face("eustice", { verb: "attack", power: 3 }, true);
    const result = dispatchBattleCommand(builder.build(), {
      type: "attack-enemy",
      actorId: "eustice",
      enemyId: builder.enemyId(0)
    });
    const firstHit = result.events.find(
      (event) => event.type === "damage-applied"
    );
    if (!firstHit) throw new Error("Expected attack damage event");
    const secondHit = {
      ...firstHit,
      id: `${firstHit.id}:second`,
      payload: {
        ...firstHit.payload,
        target: { kind: "enemy" as const, id: builder.enemyId(1) }
      },
      sequence: firstHit.sequence + 1
    };

    const grouped = groupPresentationEventsByBatch([secondHit, firstHit]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.batchId).toBe(firstHit.batchId);
    expect(grouped[0]!.events.map((event) => event.id)).toEqual([
      firstHit.id,
      secondHit.id
    ]);
  });
});
