import { describe, expect, it } from "vitest";
import {
  manorEnemyTargetAction,
  manorMemberTargetAction,
} from "./manor-battle-model";

/* 庄园版点击目标推导必须与裂隙版同语义：
 * 拿盾骰点被攻击的队友 / 点敌人卡体 / 点意图气泡，三条路径都能防御。
 * 这里只从 core 给出的合法 options 里挑选，函数不自创合法性。 */

const attackIntent = (targetId: string) => ({ kind: "attack", targetId });

describe("manorMemberTargetAction", () => {
  it("治疗选项优先于格挡", () => {
    const action = manorMemberTargetAction(
      [
        { choice: "heal", targetId: "elora" },
        { choice: "guard", targetId: "enemy-1" },
      ],
      [{ id: "enemy-1", damage: 2, intent: attackIntent("elora") }],
      "elora",
    );
    expect(action).toEqual({ choice: "heal", targetId: "elora" });
  });

  it("拿盾骰点被攻击的队友，格挡剩余威胁最大的攻击者", () => {
    const action = manorMemberTargetAction(
      [
        { choice: "guard", targetId: "enemy-1" },
        { choice: "guard", targetId: "enemy-2" },
      ],
      [
        { id: "enemy-1", damage: 1, intent: attackIntent("elora") },
        { id: "enemy-2", damage: 3, intent: attackIntent("elora") },
      ],
      "elora",
    );
    expect(action).toEqual({ choice: "guard", targetId: "enemy-2" });
  });

  it("不格挡瞄准其他队友的敌人", () => {
    const action = manorMemberTargetAction(
      [{ choice: "guard", targetId: "enemy-1" }],
      [{ id: "enemy-1", damage: 2, intent: attackIntent("kael") }],
      "elora",
    );
    expect(action).toBeNull();
  });

  it("队友未被攻击时不给出动作（让持骰者可切换或放下）", () => {
    const action = manorMemberTargetAction(
      [{ choice: "attack", targetId: "enemy-1" }],
      [{ id: "enemy-1", damage: 2, intent: attackIntent("kael") }],
      "elora",
    );
    expect(action).toBeNull();
  });

  it("红线迷宫（guard-all）对被攻击队友直接全体格挡", () => {
    const action = manorMemberTargetAction(
      [{ choice: "guard-all", targetId: null }],
      [{ id: "enemy-1", damage: 2, intent: attackIntent("elora") }],
      "elora",
    );
    expect(action).toEqual({ choice: "guard-all", targetId: null });
  });

  it("core 未提供对应 guard 选项时不推导（如骰面不是盾）", () => {
    const action = manorMemberTargetAction(
      [],
      [{ id: "enemy-1", damage: 2, intent: attackIntent("elora") }],
      "elora",
    );
    expect(action).toBeNull();
  });
});

describe("manorEnemyTargetAction", () => {
  it("攻击选项优先", () => {
    const action = manorEnemyTargetAction(
      [
        { choice: "attack", targetId: "enemy-1" },
        { choice: "guard", targetId: "enemy-1" },
      ],
      [{ id: "enemy-1", damage: 2, intent: attackIntent("elora") }],
      "enemy-1",
    );
    expect(action).toEqual({ choice: "attack", targetId: "enemy-1" });
  });

  it("拿盾骰点有攻击意图的敌人卡体即格挡该意图", () => {
    const action = manorEnemyTargetAction(
      [{ choice: "guard", targetId: "enemy-1" }],
      [{ id: "enemy-1", damage: 2, intent: attackIntent("elora") }],
      "enemy-1",
    );
    expect(action).toEqual({ choice: "guard", targetId: "enemy-1" });
  });

  it("敌人没有攻击意图时不落到格挡", () => {
    const action = manorEnemyTargetAction(
      [{ choice: "guard", targetId: "enemy-2" }],
      [
        { id: "enemy-1", damage: 0, intent: { kind: "charge" } },
        { id: "enemy-2", damage: 2, intent: attackIntent("elora") },
      ],
      "enemy-1",
    );
    expect(action).toBeNull();
  });

  it("提线（bind）与攻击同优先直达", () => {
    const action = manorEnemyTargetAction(
      [{ choice: "bind", targetId: "enemy-1" }],
      [{ id: "enemy-1", damage: 0, intent: null }],
      "enemy-1",
    );
    expect(action).toEqual({ choice: "bind", targetId: "enemy-1" });
  });

  it("红线迷宫点攻击敌人卡体也走全体格挡", () => {
    const action = manorEnemyTargetAction(
      [{ choice: "guard-all", targetId: null }],
      [{ id: "enemy-1", damage: 2, intent: attackIntent("elora") }],
      "enemy-1",
    );
    expect(action).toEqual({ choice: "guard-all", targetId: null });
  });
});
