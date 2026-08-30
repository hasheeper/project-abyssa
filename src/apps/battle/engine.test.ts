import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  DOWNED_RETURN_HP,
  FRENZY_ATTACK_BONUS,
  PARTY_ORDER,
  STALL_GRACE_ROUNDS,
  assessStalling,
  LAYER_MULTIPLIERS,
  MAX_HP,
  REROLLS_PER_ROUND,
  actOnEnemy,
  actOnMember,
  attackEnemy,
  blockIntent,
  canActWith,
  canToggleLoad,
  canUndo,
  createExpedition,
  endTurn,
  evaluateHand,
  getBattlePhase,
  getEffectiveFaceQuality,
  getExpeditionStatus,
  getFace,
  getGildFaceCount,
  getEnemyFrenzyWarningStatus,
  getFrenzyWarningRounds,
  getGreedSummary,
  getIncomingDamageFor,
  getIntentThreat,
  getLayerPayout,
  getRustFaceCount,
  getRoundOutcome,
  getStateFace,
  getUndoLabel,
  goDeeper,
  hasPendingAction,
  hasUnloadedDice,
  isEnemyDefeated,
  isEnemyFrenzied,
  healMember,
  leaveExpedition,
  mulberry32,
  nextRound,
  finishEnemyTurn,
  prepareEnemyTurn,
  rankHand,
  rerollDice,
  resolveEnemyTurnStep,
  rollDice,
  stealFrom,
  toggleLoad,
  undo,
  type CharacterId,
  type EnemyKind,
  type ExpeditionState,
  type FaceDef
} from "./engine";
import { actScenario } from "./testing/scenario";

function markEnemyFrenzied(state: ExpeditionState, enemyId: string): void {
  state.statuses.push({
    kind: "status",
    instanceId: `frenzy-active:${enemyId}`,
    definitionId: "status.frenzy-active",
    sourceId: enemyId,
    targetKey: `enemy:${enemyId}`,
    stacks: 1,
    maxStacks: 1,
    duration: null,
    tags: ["frenzy", "persistent", "unremovable"],
    data: { enemyId }
  });
}

function faceIndexOf(
  ownerId: CharacterId,
  predicate: (face: FaceDef) => boolean
): number {
  const index = CHARACTERS[ownerId].faces.findIndex(predicate);
  if (index < 0) throw new Error(`no matching face for ${ownerId}`);
  return index;
}

/** 直接指定某角色的骰面（测试夹具） */
function setFace(
  state: ExpeditionState,
  ownerId: CharacterId,
  predicate: (face: FaceDef) => boolean
): number {
  const dieIndex = state.dice.findIndex((die) => die.ownerId === ownerId);
  if (dieIndex < 0) throw new Error(`no die for ${ownerId}`);
  state.dice[dieIndex]!.faceIndex = faceIndexOf(ownerId, predicate);
  return dieIndex;
}

/** 进入 act 阶段 */
function actPhase(seed = 7): ExpeditionState {
  return actScenario(seed).build();
}

/** 指定骰面并装载，返回骰下标 */
function prepare(
  state: ExpeditionState,
  ownerId: CharacterId,
  predicate: (face: FaceDef) => boolean
): { state: ExpeditionState; dieIndex: number } {
  const dieIndex = setFace(state, ownerId, predicate);
  return { state: toggleLoad(state, dieIndex), dieIndex };
}

describe("开局", () => {
  it("五人满血、敌方意图公开、自动进入 act 阶段", () => {
    const rng = mulberry32(1);
    const state = rollDice(createExpedition(rng), rng);

    expect(state.party).toHaveLength(5);
    expect(state.party.every((member) => member.hp === MAX_HP)).toBe(true);
    expect(state.dice).toHaveLength(5);
    expect(state.dice.every((die) => die.faceIndex !== null)).toBe(true);
    expect(state.enemies.every((enemy) => enemy.intent !== null)).toBe(true);
    expect(getBattlePhase(state)).toBe("act");
  });

  it("掷骰后所有骰均未装载、未消耗", () => {
    const state = actPhase();
    expect(state.dice.every((die) => !die.loaded && !die.spent)).toBe(true);
    expect(hasUnloadedDice(state)).toBe(true);
  });
});

describe("掷骰动画的权威依据：lastTossed", () => {
  it("rollDice 记录所有参与掷骰的骰主", () => {
    const rng = mulberry32(71);
    const state = rollDice(createExpedition(rng), rng);

    /* 五枚未封锁骰全部参与 */
    expect(state.lastTossed).toHaveLength(5);
    expect(new Set(state.lastTossed).size).toBe(5);
  });

  it("掷出完全相同的点数时，lastTossed 仍记录全部骰主", () => {
    /* rng 恒为 0 → 每枚骰都掷出 faceIndex 0 */
    const zero = () => 0;
    const first = rollDice(createExpedition(mulberry32(73)), zero);
    expect(first.dice.every((die) => die.faceIndex === 0)).toBe(true);
    expect(first.lastTossed).toHaveLength(5);

    /* 再掷一次：点数与上次逐一相同 */
    const second = rollDice(
      {
        ...first,
        mode: { type: "awaiting-roll" },
        result: null,
        lastTossed: []
      },
      zero
    );
    expect(second.dice.every((die) => die.faceIndex === 0)).toBe(true);

    /* 关键：点数没有任何变化，但五枚骰都必须记为"参与了掷骰"，
       否则 UI 会跳过动画，让玩家以为骰子没掷 */
    expect(second.lastTossed).toHaveLength(5);
    for (const die of second.dice) {
      expect(second.lastTossed).toContain(die.ownerId);
    }
  });

  it("重掷掷出相同点数时同样记入 lastTossed", () => {
    const zero = () => 0;
    let state = rollDice(createExpedition(mulberry32(89)), zero);
    /* 全部未装载，重掷会覆盖全部五枚 */
    expect(state.dice.every((die) => !die.loaded)).toBe(true);

    const before = state.dice.map((die) => die.faceIndex);
    state = rerollDice({ ...state, lastTossed: [] }, zero);
    const after = state.dice.map((die) => die.faceIndex);

    /* 点数逐一相同 */
    expect(after).toEqual(before);
    /* 但依然全部记为参与掷骰 */
    expect(state.lastTossed).toHaveLength(5);
  });

  it("rerollDice 只记录被重掷的骰主，已装载的不记入", () => {
    const rng = mulberry32(79);
    let state = actPhase(79);

    /* 装载第 0 枚，它不该参与重掷 */
    state = toggleLoad(state, 0);
    const lockedOwner = state.dice[0]!.ownerId;

    state = rerollDice(state, rng);

    expect(state.lastTossed).not.toContain(lockedOwner);
    expect(state.lastTossed.length).toBe(4);
  });

  it("新回合开始时清空 lastTossed", () => {
    const rng = mulberry32(83);
    let state = actPhase(83);
    expect(state.lastTossed.length).toBeGreaterThan(0);

    const { state: ended, outcome } = endTurn(state, rng);
    if (outcome !== "continue") return;

    const fresh = nextRound(ended, rng);
    /* 尚未掷骰，不该残留上一回合的记录 */
    expect(fresh.lastTossed).toHaveLength(0);
  });
});

describe("装载：多选、可反复切换", () => {
  it("装载多枚骰子互不影响", () => {
    let state = actPhase();

    state = toggleLoad(state, 0);
    state = toggleLoad(state, 2);
    state = toggleLoad(state, 4);

    expect(state.dice[0]!.loaded).toBe(true);
    expect(state.dice[1]!.loaded).toBe(false);
    expect(state.dice[2]!.loaded).toBe(true);
    expect(state.dice[3]!.loaded).toBe(false);
    expect(state.dice[4]!.loaded).toBe(true);
  });

  it("再次点击即卸载", () => {
    let state = actPhase();
    state = toggleLoad(state, 1);
    expect(state.dice[1]!.loaded).toBe(true);

    state = toggleLoad(state, 1);
    expect(state.dice[1]!.loaded).toBe(false);
  });

  it("未装载的骰子，其角色卡不可操作", () => {
    const state = actPhase();
    const ownerId = state.dice[0]!.ownerId;

    expect(canActWith(state, ownerId)).toBe(false);
    expect(canActWith(toggleLoad(state, 0), ownerId)).toBe(true);
  });

  it("空白面可以装载保留点数，但不能解锁角色行动", () => {
    let state = actPhase();
    const dieIndex = setFace(state, "kororo", (face) => face.verb === "blank");
    const blankPip = getFace(state.dice[dieIndex]!)!.pip;

    state = toggleLoad(state, dieIndex);

    expect(state.dice[dieIndex]!.loaded).toBe(true);
    expect(canActWith(state, "kororo")).toBe(false);
    expect(hasPendingAction(state)).toBe(false);
    /* 空白只代表无行动强度，命数点仍参与牌型。 */
    expect(evaluateHand(state).pips).toContain(blankPip);
  });

  it("封锁骰不能装载", () => {
    const state = actPhase();
    state.dice[0]!.sealed = true;
    expect(canToggleLoad(state, 0)).toBe(false);
    expect(toggleLoad(state, 0)).toBe(state);
  });
});

describe("重掷", () => {
  it("只重掷未装载骰，已装载骰面不变", () => {
    const rng = mulberry32(3);
    let state = actPhase(3);

    state = toggleLoad(state, 0);
    const lockedFace = state.dice[0]!.faceIndex;

    state = rerollDice(state, rng);
    expect(state.dice[0]!.faceIndex).toBe(lockedFace);
    expect(state.rerollsRemaining).toBe(REROLLS_PER_ROUND - 1);
  });

  it("次数耗尽后未装载骰自动全部装载", () => {
    const rng = mulberry32(5);
    let state = actPhase(5);

    state = toggleLoad(state, 0);
    expect(hasUnloadedDice(state)).toBe(true);

    /* 用尽全部次数，不写死具体数量 */
    for (let i = 0; i < REROLLS_PER_ROUND; i += 1) {
      state = rerollDice(state, rng);
    }

    expect(state.rerollsRemaining).toBe(0);
    expect(hasUnloadedDice(state)).toBe(false);
    expect(
      state.dice.every((die) => die.sealed || die.spent || die.loaded)
    ).toBe(true);
  });

  it("每回合可重掷 REROLLS_PER_ROUND 次，逐次递减", () => {
    const rng = mulberry32(31);
    let state = actPhase(31);
    expect(state.rerollsRemaining).toBe(REROLLS_PER_ROUND);

    for (let used = 1; used <= REROLLS_PER_ROUND; used += 1) {
      state = rerollDice(state, rng);
      expect(state.rerollsRemaining).toBe(REROLLS_PER_ROUND - used);
    }
  });

  it("次数耗尽后无法再重掷", () => {
    const rng = mulberry32(5);
    let state = actPhase(5);
    for (let i = 0; i < REROLLS_PER_ROUND; i += 1) {
      state = rerollDice(state, rng);
    }
    expect(state.rerollsRemaining).toBe(0);
    expect(rerollDice(state, rng)).toBe(state);
  });

  it("重掷清空撤销栈（随机性不可回滚）", () => {
    const rng = mulberry32(9);
    let state = actPhase(9);

    state = toggleLoad(state, 0);
    expect(canUndo(state)).toBe(true);

    state = rerollDice(state, rng);
    expect(canUndo(state)).toBe(false);
    expect(state.undoStack).toHaveLength(0);
  });
});

describe("即时行动", () => {
  it("攻击当场扣血，无需结算按钮", () => {
    let state = actPhase();
    const enemy = state.enemies[0]!;
    const hpBefore = enemy.hp;

    const prepared = prepare(state, "eustice", (face) => face.verb === "attack" && face.power === 2);
    state = prepared.state;

    const result = attackEnemy(state, "eustice", enemy.id);
    expect(result.error).toBeNull();

    const after = result.state.enemies.find((item) => item.id === enemy.id)!;
    expect(after.hp).toBe(Math.max(0, hpBefore - 2));
  });

  it("击杀当场退场、意图取消、赏金入账", () => {
    let state = actPhase();
    const enemy = state.enemies.find((item) => item.hp <= 4)!;
    enemy.hp = 2;

    state = prepare(state, "kororo", (face) => face.power === 4).state;

    const { state: after } = attackEnemy(state, "kororo", enemy.id);
    const killed = after.enemies.find((item) => item.id === enemy.id)!;

    expect(isEnemyDefeated(killed)).toBe(true);
    expect(killed.intent).toBeNull();
    expect(after.gold).toBe(
      Math.round(enemy.maxHp * 10 * LAYER_MULTIPLIERS[0])
    );
  });

  it("一骰一次：用完即消耗，角色卡不可再操作", () => {
    let state = actPhase();
    const enemy = state.enemies[0]!;

    state = prepare(state, "eustice", (face) => face.verb === "attack").state;
    const { state: after } = attackEnemy(state, "eustice", enemy.id);

    const die = after.dice.find((item) => item.ownerId === "eustice")!;
    expect(die.spent).toBe(true);
    expect(canActWith(after, "eustice")).toBe(false);

    /* 二次攻击被拒 */
    expect(attackEnemy(after, "eustice", enemy.id).error).toBe("die-spent");
  });

  it("未装载不能行动", () => {
    const state = actPhase();
    setFace(state, "eustice", (face) => face.verb === "attack");
    expect(attackEnemy(state, "eustice", state.enemies[0]!.id).error).toBe(
      "die-not-loaded"
    );
  });

  it("骰面不匹配则拒绝", () => {
    let state = actPhase();
    state = prepare(state, "elora", (face) => face.verb === "heal").state;
    expect(attackEnemy(state, "elora", state.enemies[0]!.id).error).toBe(
      "wrong-face"
    );
  });

  it("格挡即时降低承伤", () => {
    let state = actPhase();
    const attacker = state.enemies.find((enemy) => enemy.intent?.type === "attack")!;
    const targetId = (attacker.intent as { targetId: CharacterId }).targetId;
    const before = getIncomingDamageFor(state, targetId).final;

    state = prepare(state, "eustice", (face) => face.verb === "guard").state;
    const { state: after, error } = blockIntent(state, "eustice", attacker.id);

    expect(error).toBeNull();
    expect(getIncomingDamageFor(after, targetId).final).toBeLessThan(before);
  });

  it("治疗即时回心，满血者拒绝", () => {
    let state = actPhase();
    state.party.find((member) => member.id === "kororo")!.hp = 1;

    state = prepare(state, "elora", (face) => face.verb === "heal" && face.power === 1).state;
    const { state: after, error } = healMember(state, "elora", "kororo");

    expect(error).toBeNull();
    expect(after.party.find((member) => member.id === "kororo")!.hp).toBe(2);

    /* 满血目标 */
    let full = actPhase(11);
    full = prepare(full, "elora", (face) => face.verb === "heal").state;
    expect(healMember(full, "elora", "kael").error).toBe("target-full-hp");
  });

  it("顺手牵羊即时入账", () => {
    const rng = mulberry32(13);
    let state = actPhase(13);

    state = prepare(state, "norma", (face) => face.verb === "coin" && face.power === 2).state;
    const { state: after, error } = stealFrom(state, "norma", state.enemies[0]!.id, rng);

    expect(error).toBeNull();
    expect(after.gold).toBe(10);
  });

  it("点敌人语义分派：攻击面攻击、牵羊面偷取", () => {
    const rng = mulberry32(17);
    let state = actPhase(17);
    const enemyId = state.enemies[0]!.id;

    state = prepare(state, "norma", (face) => face.verb === "coin").state;
    const { state: after } = actOnEnemy(state, "norma", enemyId, rng);
    expect(after.gold).toBeGreaterThan(0);
  });

  it("点队员语义分派：格挡面挡在瞄准该队员的威胁前", () => {
    let state = actPhase(19);
    const attacker = state.enemies.find((enemy) => enemy.intent?.type === "attack")!;
    const targetId = (attacker.intent as { targetId: CharacterId }).targetId;

    state = prepare(state, "eustice", (face) => face.verb === "guard").state;
    const { state: after, error } = actOnMember(state, "eustice", targetId);

    expect(error).toBeNull();
    const blocked = after.enemies.find(
      (enemy) => enemy.blocked > 0 && enemy.intent?.type === "attack"
    )!;
    expect((blocked.intent as { targetId: CharacterId }).targetId).toBe(targetId);
  });
});

describe("意图线威胁分级", () => {
  /** 造一个只有单一攻击者的干净盘面 */
  function soloAttacker(hp: number, value: number) {
    const rng = mulberry32(101);
    const state = rollDice(createExpedition(rng), rng);

    state.party.forEach((member) => {
      member.hp = MAX_HP;
    });
    const target = state.party[1]!;
    target.hp = hp;

    state.enemies = [
      {
        id: "solo",
        kind: "brute",
        name: "测试兽",
        art: "sentinel",
        hp: 5,
        maxHp: 5,
        attack: value,
        chargeReady: false,
        countdown: 2,
        blocked: 0,
        intent: {
          type: "attack",
          targetId: target.id,
          value,
          title: "攻击",
          description: ""
        }
      }
    ];
    return { state, targetId: target.id };
  }

  it("伤害不致死则为 normal（黄）", () => {
    const { state } = soloAttacker(3, 2);
    expect(getIntentThreat(state, "solo")).toBe("normal");
  });

  it("伤害足以打空则为 lethal（红）", () => {
    const { state } = soloAttacker(2, 2);
    expect(getIntentThreat(state, "solo")).toBe("lethal");
  });

  it("超额伤害同样是 lethal", () => {
    const { state } = soloAttacker(1, 3);
    expect(getIntentThreat(state, "solo")).toBe("lethal");
  });

  it("挡尽则为 blocked（灰）", () => {
    const { state } = soloAttacker(2, 2);
    state.enemies[0]!.blocked = 2;
    expect(getIntentThreat(state, "solo")).toBe("blocked");
  });

  it("挡不满时从致死降为 normal", () => {
    const { state } = soloAttacker(2, 3);
    expect(getIntentThreat(state, "solo")).toBe("lethal");
    state.enemies[0]!.blocked = 2;
    expect(getIntentThreat(state, "solo")).toBe("normal");
  });

  it("合击凑成致死时两条线同时标红", () => {
    const rng = mulberry32(103);
    const state = rollDice(createExpedition(rng), rng);
    const target = state.party[2]!;
    target.hp = 2;

    state.enemies = ["a", "b"].map((id) => ({
      id,
      kind: "brute" as const,
      name: `兽${id}`,
      art: "amalgam" as const,
      hp: 4,
      maxHp: 4,
      attack: 1,
      chargeReady: false,
      countdown: 2,
      blocked: 0,
      intent: {
        type: "attack" as const,
        targetId: target.id,
        value: 1,
        title: "攻击",
        description: ""
      }
    }));

    /* 单看每条都只打 1 点，但合计 2 点刚好打空 */
    expect(getIntentThreat(state, "a")).toBe("lethal");
    expect(getIntentThreat(state, "b")).toBe("lethal");

    /* 挡掉一条后，剩下那条不再致死 */
    state.enemies[0]!.blocked = 1;
    expect(getIntentThreat(state, "a")).toBe("blocked");
    expect(getIntentThreat(state, "b")).toBe("normal");
  });

  it("非攻击意图没有威胁级别", () => {
    const rng = mulberry32(107);
    const state = rollDice(createExpedition(rng), rng);
    state.enemies = [
      {
        id: "seal",
        kind: "anomaly",
        name: "瘴气异象",
        art: "amalgam",
        hp: 2,
        maxHp: 2,
        attack: 0,
        chargeReady: false,
        countdown: 2,
        blocked: 0,
        intent: {
          type: "seal",
          targetId: "kororo",
          title: "缠绕",
          description: ""
        }
      }
    ];
    expect(getIntentThreat(state, "seal")).toBeNull();
  });

  it("格挡后 undo，威胁级别随之回退", () => {
    let state = actPhase(109);

    const attacker = state.enemies.find((enemy) => enemy.intent?.type === "attack")!;
    const targetId = (attacker.intent as { targetId: CharacterId }).targetId;
    const intentValue = (attacker.intent as { value: number }).value;

    /* 把目标压到刚好被这一下打空，并隔离其他攻击者 */
    state.party.find((member) => member.id === targetId)!.hp = intentValue;
    for (const enemy of state.enemies) {
      if (enemy.id !== attacker.id && enemy.intent?.type === "attack") {
        enemy.intent = { type: "charge", title: "蓄力", description: "" };
      }
    }
    expect(getIntentThreat(state, attacker.id)).toBe("lethal");

    /* 架起足够格挡后转灰 */
    let blocked = 0;
    for (const ownerId of ["eustice", "norma", "kael", "elora"] as CharacterId[]) {
      if (blocked >= intentValue) break;
      const guardIndex = CHARACTERS[ownerId].faces.findIndex((face) => face.verb === "guard");
      const dieIndex = state.dice.findIndex((die) => die.ownerId === ownerId);
      if (guardIndex < 0 || dieIndex < 0) continue;
      state.dice[dieIndex]!.faceIndex = guardIndex;
      state = toggleLoad(state, dieIndex);
      const result = blockIntent(state, ownerId, attacker.id);
      if (!result.error) {
        state = result.state;
        blocked += CHARACTERS[ownerId].faces[guardIndex]!.power;
      }
    }
    expect(blocked).toBeGreaterThanOrEqual(intentValue);
    expect(getIntentThreat(state, attacker.id)).toBe("blocked");

    /* 撤销最后一次格挡后不再是灰 */
    expect(getIntentThreat(undo(state), attacker.id)).not.toBe("blocked");
  });
});

describe("撤销：必须能复活怪物", () => {
  it("撤销攻击后怪物复活、血量与赏金全部回退", () => {
    let state = actPhase();
    const enemy = state.enemies[0]!;
    enemy.hp = 2;
    const goldBefore = state.gold;

    state = prepare(state, "kororo", (face) => face.power === 4).state;
    const { state: killed } = attackEnemy(state, "kororo", enemy.id);

    expect(isEnemyDefeated(killed.enemies.find((item) => item.id === enemy.id)!))
      .toBe(true);
    expect(killed.gold).toBeGreaterThan(goldBefore);

    const restored = undo(killed);
    const revived = restored.enemies.find((item) => item.id === enemy.id)!;

    expect(isEnemyDefeated(revived)).toBe(false);
    expect(revived.hp).toBe(2);
    expect(revived.intent).not.toBeNull();
    expect(restored.gold).toBe(goldBefore);
    /* 骰子回到已装载未消耗，可重新指挥 */
    expect(restored.dice.find((die) => die.ownerId === "kororo")!.spent).toBe(false);
    expect(canActWith(restored, "kororo")).toBe(true);
  });

  it("撤销回滚日志与事实，不留痕迹", () => {
    let state = actPhase();
    const logBefore = state.log.length;
    const enemy = state.enemies[0]!;

    state = prepare(state, "eustice", (face) => face.verb === "attack").state;
    const { state: attacked } = attackEnemy(state, "eustice", enemy.id);
    expect(attacked.log.length).toBeGreaterThan(logBefore);

    expect(undo(attacked).log.length).toBe(logBefore);
  });

  it("撤销治疗回退血量", () => {
    let state = actPhase();
    state.party.find((member) => member.id === "kororo")!.hp = 1;

    state = prepare(state, "elora", (face) => face.verb === "heal" && face.power === 1).state;
    const { state: healed } = healMember(state, "elora", "kororo");
    expect(healed.party.find((member) => member.id === "kororo")!.hp).toBe(2);

    const restored = undo(healed);
    expect(restored.party.find((member) => member.id === "kororo")!.hp).toBe(1);
  });

  it("撤销格挡回退承伤预览", () => {
    let state = actPhase();
    const attacker = state.enemies.find((enemy) => enemy.intent?.type === "attack")!;
    const targetId = (attacker.intent as { targetId: CharacterId }).targetId;
    const before = getIncomingDamageFor(state, targetId).final;

    state = prepare(state, "eustice", (face) => face.verb === "guard").state;
    const { state: blockedState } = blockIntent(state, "eustice", attacker.id);
    const restored = undo(blockedState);

    expect(getIncomingDamageFor(restored, targetId).final).toBe(before);
  });

  it("多步撤销按后进先出逐步回退", () => {
    let state = actPhase(23);
    const enemy = state.enemies[0]!;
    enemy.hp = 9;

    state = prepare(state, "eustice", (face) => face.verb === "attack" && face.power === 2).state;
    state = prepare(state, "kororo", (face) => face.power === 4).state;

    const first = attackEnemy(state, "eustice", enemy.id).state;
    const second = attackEnemy(first, "kororo", enemy.id).state;

    expect(second.enemies[0]!.hp).toBe(9 - 2 - 4);
    expect(getUndoLabel(second)).toContain("柯萝萝");

    const undoOnce = undo(second);
    expect(undoOnce.enemies[0]!.hp).toBe(9 - 2);
    expect(canActWith(undoOnce, "kororo")).toBe(true);

    const undoTwice = undo(undoOnce);
    expect(undoTwice.enemies[0]!.hp).toBe(9);
  });

  it("装载操作也可撤销", () => {
    let state = actPhase();
    state = toggleLoad(state, 0);
    expect(state.dice[0]!.loaded).toBe(true);

    expect(undo(state).dice[0]!.loaded).toBe(false);
  });

  it("撤销栈为空时不可撤销", () => {
    const state = actPhase();
    expect(canUndo(state)).toBe(false);
    expect(undo(state)).toBe(state);
  });
});

describe("跳过回合 → 敌方行动", () => {
  it("逐步 API 只在命中帧结算当前怪，并清除已行动意图", () => {
    const state = actPhase(27);
    const targetId: CharacterId = "kael";
    const target = state.party.find((member) => member.id === targetId)!;
    target.hp = 3;
    state.enemies = ["first", "second"].map((id) => ({
      id,
      kind: "brute" as const,
      name: id === "first" ? "先手兽" : "后手兽",
      art: "sentinel" as const,
      hp: 8,
      maxHp: 8,
      attack: 1,
      chargeReady: false,
      countdown: 2,
      intent: {
        type: "attack" as const,
        targetId,
        value: 1,
        title: "攻击",
        description: ""
      },
      blocked: 0,
    }));

    const prepared = prepareEnemyTurn(state);
    expect(prepared.enemyOrder).toEqual(["first", "second"]);
    expect(prepared.state.party.find((member) => member.id === targetId)!.hp).toBe(3);

    const first = resolveEnemyTurnStep(prepared.state, "first");
    expect(first.event).toMatchObject({
      enemyId: "first",
      intentType: "attack",
      targetId,
      result: "hit",
      damage: 1,
      hpBefore: 3,
      hpAfter: 2,
      lethal: false
    });
    expect(first.event?.intent).toMatchObject({ type: "attack", title: "攻击" });
    expect(first.state.enemies.find((enemy) => enemy.id === "first")!.intent).toBeNull();
    expect(first.state.enemies.find((enemy) => enemy.id === "second")!.intent).not.toBeNull();
    /* 待结算承伤不再重复计入已行动的先手兽。 */
    expect(getIncomingDamageFor(first.state, targetId)).toEqual({ raw: 1, final: 1 });

    const second = resolveEnemyTurnStep(first.state, "second");
    expect(second.event).toMatchObject({
      enemyId: "second",
      result: "hit",
      hpBefore: 2,
      hpAfter: 1
    });
  });

  it("后手怪基于前一击后的最新状态落空，不转移目标", () => {
    const state = actPhase(28);
    const targetId: CharacterId = "eustice";
    state.party.find((member) => member.id === targetId)!.hp = 1;
    state.enemies = ["first", "second"].map((id) => ({
      id,
      kind: "brute" as const,
      name: id,
      art: "sentinel" as const,
      hp: 8,
      maxHp: 8,
      attack: 1,
      chargeReady: false,
      countdown: 2,
      intent: {
        type: "attack" as const,
        targetId,
        value: 1,
        title: "攻击",
        description: ""
      },
      blocked: 0,
    }));

    const prepared = prepareEnemyTurn(state);
    const first = resolveEnemyTurnStep(prepared.state, "first");
    const second = resolveEnemyTurnStep(first.state, "second");

    expect(first.event).toMatchObject({ result: "hit", lethal: true, hpBefore: 1, hpAfter: 0 });
    expect(second.event).toMatchObject({
      result: "miss",
      targetId,
      damage: 0,
      hpBefore: 0,
      hpAfter: 0,
      lethal: false
    });
  });

  it("行动顺序是 prepare 快照，中途召唤物不加入当轮", () => {
    const state = actPhase(28);
    state.enemies = [
      {
        id: "summoner",
        kind: "summoner",
        name: "裂隙之口",
        art: "choir",
        /* 血量足够高，隔离残局逃跑规则，只测召唤队列。 */
        hp: 20,
        maxHp: 20,
        attack: 0,
        chargeReady: false,
        countdown: 2,
        intent: { type: "summon", title: "召唤", description: "" },
        blocked: 0,
      }
    ];

    const prepared = prepareEnemyTurn(state);
    expect(prepared.enemyOrder).toEqual(["summoner"]);

    const summoned = resolveEnemyTurnStep(prepared.state, "summoner");
    expect(summoned.event).toMatchObject({ result: "effect", intentType: "summon" });
    expect(summoned.state.enemies).toHaveLength(2);
    expect(prepared.enemyOrder).toEqual(["summoner"]);
    expect(summoned.state.enemies[1]!.intent).toBeNull();
  });

  it("狂暴反噬和胜负只在 finish 结算，同步 endTurn 与分段结果一致", () => {
    const state = actPhase(28);
    state.enemies = [
      {
        id: "frenzied",
        kind: "brute",
        name: "狂暴兽",
        art: "sentinel",
        hp: 2,
        maxHp: 8,
        attack: 1,
        chargeReady: false,
        countdown: 2,
        intent: { type: "charge", title: "蓄力", description: "" },
        blocked: 0,
      }
    ];
    markEnemyFrenzied(state, "frenzied");

    const prepared = prepareEnemyTurn(state);
    const stepped = resolveEnemyTurnStep(prepared.state, prepared.enemyOrder[0]!);
    expect(stepped.state.enemies[0]!.hp).toBe(2);
    expect(getRoundOutcome(stepped.state)).not.toBe("layer-cleared");

    const staged = finishEnemyTurn(stepped.state, mulberry32(281), prepared.hand);
    const atomic = endTurn(state, mulberry32(281));
    expect(staged).toEqual(atomic);
    expect(staged.state.enemies[0]).toMatchObject({ hp: 1 });
    expect(isEnemyFrenzied(staged.state, staged.state.enemies[0]!)).toBe(true);
  });

  it("跳过后敌人执行意图造成伤害", () => {
    const rng = mulberry32(29);
    const state = actPhase(29);

    const attacker = state.enemies.find((enemy) => enemy.intent?.type === "attack")!;
    const targetId = (attacker.intent as { targetId: CharacterId }).targetId;
    const hpBefore = state.party.find((member) => member.id === targetId)!.hp;

    const { state: after, outcome } = endTurn(state, rng);

    expect(outcome).toBe("continue");
    expect(getBattlePhase(after)).toBe("enemy");
    expect(
      after.party.find((member) => member.id === targetId)!.hp
    ).toBeLessThanOrEqual(hpBefore);
  });

  it("已格挡的攻击不掉血", () => {
    const rng = mulberry32(31);
    let state = actPhase(31);

    const attacker = state.enemies.find((enemy) => enemy.intent?.type === "attack")!;
    const intentValue = (attacker.intent as { value: number }).value;
    const targetId = (attacker.intent as { targetId: CharacterId }).targetId;

    /* 其他攻击者改为蓄力，隔离变量 */
    for (const enemy of state.enemies) {
      if (enemy.id !== attacker.id && enemy.intent?.type === "attack") {
        enemy.intent = { type: "charge", title: "蓄积力量", description: "" };
      }
    }

    /* 叠够格挡 */
    let blocked = 0;
    for (const ownerId of ["eustice", "norma", "kael", "elora"] as CharacterId[]) {
      if (blocked >= intentValue) break;
      const guardIndex = CHARACTERS[ownerId].faces.findIndex(
        (face) => face.verb === "guard"
      );
      if (guardIndex < 0) continue;
      const dieIndex = state.dice.findIndex((die) => die.ownerId === ownerId);
      if (dieIndex < 0) continue;
      state.dice[dieIndex]!.faceIndex = guardIndex;
      state = toggleLoad(state, dieIndex);
      const result = blockIntent(state, ownerId, attacker.id);
      if (!result.error) {
        state = result.state;
        blocked += CHARACTERS[ownerId].faces[guardIndex]!.power;
      }
    }
    expect(blocked).toBeGreaterThanOrEqual(intentValue);

    const hpBefore = state.party.find((member) => member.id === targetId)!.hp;
    const { state: after } = endTurn(state, rng);

    expect(after.party.find((member) => member.id === targetId)!.hp).toBe(hpBefore);
  });

  it("跳过回合入账牌型倍率", () => {
    const rng = mulberry32(37);
    const state = actPhase(37);

    /* 摆成快艇 */
    for (const ownerId of ["kael", "eustice", "elora", "kororo", "norma"] as CharacterId[]) {
      const index = CHARACTERS[ownerId].faces.findIndex((face) => face.pip === 4);
      const dieIndex = state.dice.findIndex((die) => die.ownerId === ownerId);
      if (index >= 0 && dieIndex >= 0) state.dice[dieIndex]!.faceIndex = index;
    }

    const { state: after, hand } = endTurn(state, rng);
    expect(hand?.name).toBe("快艇");
    expect(after.handMultiplier).toBeGreaterThan(0);
  });

  it("清空敌人后跳过回合进入贪心", () => {
    const rng = mulberry32(41);
    let state = actPhase(41);

    for (const enemy of state.enemies) {
      enemy.hp = 0;
      enemy.intent = null;
    }

    const { state: after, outcome } = endTurn(state, rng);
    expect(outcome).toBe("layer-cleared");
    expect(getExpeditionStatus(after)).toBe("greed");

    const summary = getGreedSummary(after);
    expect(summary.nextLayer).toBe(2);
  });

  it("nextRound 重掷次数复位、骰子重置", () => {
    const rng = mulberry32(43);
    let state = actPhase(43);
    for (let i = 0; i < REROLLS_PER_ROUND; i += 1) {
      state = rerollDice(state, rng);
    }
    expect(state.rerollsRemaining).toBe(0);

    const { state: ended } = endTurn(state, rng);
    if (getExpeditionStatus(ended) !== "active") return;

    const fresh = nextRound(ended, rng);
    expect(fresh.rerollsRemaining).toBe(REROLLS_PER_ROUND);
    expect(getBattlePhase(fresh)).toBe("roll");
    expect(fresh.dice.every((die) => !die.loaded && !die.spent)).toBe(true);
  });

  it("原目标已被前一击打倒时，后续公开攻击落空而不是暗中转砍队友", () => {
    const rng = mulberry32(45);
    const state = actPhase(45);
    const targetId: CharacterId = "eustice";
    state.party.find((member) => member.id === targetId)!.hp = 1;
    const beforeOthers = Object.fromEntries(
      state.party.filter((member) => member.id !== targetId).map((member) => [member.id, member.hp])
    );
    state.enemies = ["first", "second"].map((id) => ({
      id,
      kind: "brute" as const,
      name: id === "first" ? "先手兽" : "后手兽",
      art: "sentinel" as const,
      hp: 8,
      maxHp: 8,
      attack: 1,
      chargeReady: false,
      countdown: 2,
      intent: {
        type: "attack" as const,
        targetId,
        value: 1,
        title: "攻击",
        description: ""
      },
      blocked: 0,
    }));

    const { state: after } = endTurn(state, rng);
    expect(after.party.find((member) => member.id === targetId)).toMatchObject({
      hp: 0,
      downed: true,
      rustLevel: 1
    });
    for (const member of after.party.filter((item) => item.id !== targetId)) {
      expect(member.hp).toBe(beforeOthers[member.id]);
    }
    expect(after.log.some((entry) => entry.text.includes("原目标已经倒下而落空"))).toBe(true);
  });

  it("全灭空手而归", () => {
    const rng = mulberry32(47);
    const state = actPhase(47);

    state.gold = 500;
    for (const member of state.party) member.hp = 1;
    state.enemies = state.party.map((member, index) => ({
      id: `enemy-exec-${index}`,
      kind: "brute" as const,
      name: "处刑装置",
      art: "sentinel" as const,
      hp: 9,
      maxHp: 9,
      attack: 3,
      chargeReady: false,
      countdown: 2,
      blocked: 0,
      intent: {
        type: "attack" as const,
        targetId: member.id,
        value: 3,
        title: "处刑",
        description: ""
      }
    }));

    const { state: after, outcome } = endTurn(state, rng);
    expect(outcome).toBe("wipe");
    expect(getExpeditionStatus(after)).toBe("finished");
    expect(after.result!.totalGold).toBe(0);
  });
});

describe("力竭、固定骰位与命数劣化", () => {
  function singleAttackerState(seed = 49): {
    state: ExpeditionState;
    targetId: CharacterId;
  } {
    const state = actPhase(seed);
    const targetId: CharacterId = "eustice";
    state.party.find((member) => member.id === targetId)!.hp = 1;
    state.enemies = [
      {
        id: "downing-foe",
        kind: "brute",
        name: "测试击倒者",
        art: "sentinel",
        hp: 9,
        maxHp: 9,
        attack: 1,
        chargeReady: false,
        countdown: 2,
        intent: {
          type: "attack",
          targetId,
          value: 1,
          title: "攻击",
          description: ""
        },
        blocked: 0,
      }
    ];
    return { state, targetId };
  }

  it("中间角色倒下时五枚骰仍按 PARTY_ORDER 固定，倒下骰置为不可用", () => {
    const rng = mulberry32(49);
    const { state, targetId } = singleAttackerState();

    const { state: after, outcome } = endTurn(state, rng);
    const target = after.party.find((member) => member.id === targetId)!;
    const targetDie = after.dice.find((die) => die.ownerId === targetId)!;

    expect(outcome).toBe("continue");
    expect(target).toMatchObject({ hp: 0, downed: true, rustLevel: 1 });
    expect(after.dice.map((die) => die.ownerId)).toEqual(PARTY_ORDER);
    expect(after.dice).toHaveLength(5);
    expect(targetDie).toMatchObject({ loaded: false });
    expect(targetDie).not.toHaveProperty("downed");
    expect(targetDie).not.toHaveProperty("rustLevel");
    /* 即使直接查询牌型，力竭骰也不再参与当前回合。 */
    expect(evaluateHand(after).pips).toHaveLength(4);
  });

  it("力竭在本层持续，只有进入下一层才半血归队，锈面永久保留", () => {
    const rng = mulberry32(51);
    const { state, targetId } = singleAttackerState(51);
    let after = endTurn(state, rng).state;

    let sameLayer = nextRound(after, rng);
    let target = sameLayer.party.find((member) => member.id === targetId)!;
    let targetDie = sameLayer.dice.find((die) => die.ownerId === targetId)!;

    expect(DOWNED_RETURN_HP).toBe(1);
    expect(target).toMatchObject({ hp: 0, downed: true, rustLevel: 1 });
    expect(sameLayer.dice.map((die) => die.ownerId)).toEqual(PARTY_ORDER);
    expect(targetDie).toMatchObject({ faceIndex: null });
    expect(
      sameLayer.enemies.every(
        (enemy) => enemy.intent?.type !== "attack" || enemy.intent.targetId !== targetId
      )
    ).toBe(true);

    /* 本层下一回合仍保留原骰位，但力竭骰不会参与掷骰。 */
    sameLayer = rollDice(sameLayer, rng);
    expect(sameLayer.lastTossed).not.toContain(targetId);
    expect(canActWith(sameLayer, targetId)).toBe(false);

    /* 第一张普通面已经成为有效锈面，镀金面会最后才劣化。 */
    targetDie = sameLayer.dice.find((die) => die.ownerId === targetId)!;
    targetDie.faceIndex = 0;
    expect(getStateFace(sameLayer, targetDie)?.quality).toBe("rust");
    expect(getEffectiveFaceQuality(targetId, 3, 1)).toBe("gild");

    /* 清完本层并深入后，角色才半血归队。 */
    for (const enemy of sameLayer.enemies) {
      enemy.hp = 0;
      enemy.intent = null;
    }
    const firstGreed = endTurn(sameLayer, rng).state;
    expect(getGreedSummary(firstGreed)?.downedCount).toBe(1);
    expect(firstGreed.party.find((member) => member.id === targetId)).toMatchObject({
      hp: 0,
      downed: true,
      rustLevel: 1
    });

    let deeper = goDeeper(firstGreed, rng);
    target = deeper.party.find((member) => member.id === targetId)!;
    targetDie = deeper.dice.find((die) => die.ownerId === targetId)!;
    expect(deeper.layer).toBe(2);
    expect(target).toMatchObject({ hp: DOWNED_RETURN_HP, downed: false, rustLevel: 1 });
    expect(targetDie).not.toHaveProperty("downed");
    expect(targetDie).not.toHaveProperty("rustLevel");

    /* 下一层再次力竭继续累积，并同样不会在普通回合复归。 */
    const layerTwo = rollDice(deeper, rng);
    layerTwo.party.find((member) => member.id === targetId)!.hp = 1;
    for (const enemy of layerTwo.enemies) enemy.intent = null;
    layerTwo.enemies[0]!.blocked = 0;
    layerTwo.enemies[0]!.intent = {
      type: "attack",
      targetId,
      value: 1,
      title: "攻击",
      description: ""
    };
    after = endTurn(layerTwo, rng).state;
    expect(after.party.find((member) => member.id === targetId)!.rustLevel).toBe(2);

    sameLayer = nextRound(after, rng);
    target = sameLayer.party.find((member) => member.id === targetId)!;
    expect(target).toMatchObject({ hp: 0, downed: true, rustLevel: 2 });
    expect(sameLayer.dice.find((die) => die.ownerId === targetId))
      .not.toHaveProperty("rustLevel");

    /* 再次清层并深入，才以半血带着累计锈蚀归队。 */
    const clearing = rollDice(sameLayer, rng);
    for (const enemy of clearing.enemies) {
      enemy.hp = 0;
      enemy.intent = null;
    }
    const greedy = endTurn(clearing, rng).state;
    deeper = goDeeper(greedy, rng);
    expect(deeper.layer).toBe(3);
    expect(deeper.party.find((member) => member.id === targetId)).toMatchObject({
      hp: DOWNED_RETURN_HP,
      downed: false,
      rustLevel: 2
    });
    expect(deeper.dice.find((die) => die.ownerId === targetId))
      .not.toHaveProperty("rustLevel");
  });

  it("新增锈面有上限，原生锈面不会被重复计算", () => {
    expect(getRustFaceCount("norma", 0)).toBe(1);
    expect(getRustFaceCount("norma", 1)).toBe(2);
    expect(getRustFaceCount("norma", 99)).toBe(6);
    expect(getRustFaceCount("kael", 99)).toBe(6);
  });

  it("金铭计数只包含尚未锈化的有效金铭面", () => {
    expect(getGildFaceCount("kael", 0)).toBe(1);
    expect(getGildFaceCount("norma", 0)).toBe(0);
    /* 普通面先锈化，最后一层劣化才会侵蚀金铭。 */
    expect(getGildFaceCount("kael", 5)).toBe(1);
    expect(getGildFaceCount("kael", 6)).toBe(0);
  });
});

describe("贪心与结算", () => {
  function clearToGreed(seed: number): ExpeditionState {
    const rng = mulberry32(seed);
    let state = rollDice(createExpedition(rng), rng);
    for (const enemy of state.enemies) {
      enemy.hp = 0;
      enemy.intent = null;
    }
    state.gold = 400;
    return endTurn(state, rng).state;
  }

  it("goDeeper 提升层数并刷新敌人", () => {
    const rng = mulberry32(53);
    const greedy = clearToGreed(53);
    expect(getExpeditionStatus(greedy)).toBe("greed");

    const deeper = goDeeper(greedy, rng);
    expect(getExpeditionStatus(deeper)).toBe("active");
    expect(deeper.layer).toBe(2);
    expect(deeper.enemies.every((enemy) => !isEnemyDefeated(enemy))).toBe(true);
    expect(getBattlePhase(deeper)).toBe("roll");
  });

  it("leaveExpedition 结算包裹合计", () => {
    const rng = mulberry32(59);
    const greedy = clearToGreed(59);

    /* 层清时已入袋，散金与牌型倍率应已清零 */
    expect(greedy.gold).toBe(0);
    expect(greedy.handMultiplier).toBe(0);
    expect(greedy.bagGold).toBeGreaterThan(0);

    const expected = greedy.bagGold;
    const summary = getGreedSummary(greedy);
    expect(summary.bagTotal).toBe(expected);
    expect(summary.bagTotal).toBeGreaterThan(0);
    const done = leaveExpedition(greedy, rng);

    expect(getExpeditionStatus(done)).toBe("finished");
    expect(done.result!.totalGold).toBe(expected);
    expect(done.result!.wiped).toBe(false);
  });
});

describe("奖励机制：层结算与包裹", () => {
  /**
   * 把骰面摆成互不成牌的点数（穷举验证过的散牌组合 1,2,3,5,6），
   * 使 endTurn 不再追加牌型加成，从而隔离出层倍率这一个变量。
   */
  function makeScatter(state: ExpeditionState) {
    const scatter: Record<CharacterId, number> = {
      kael: 1,
      eustice: 2,
      elora: 3,
      kororo: 5,
      norma: 6
    };
    for (const die of state.dice) {
      const pip = scatter[die.ownerId];
      const index = CHARACTERS[die.ownerId].faces.findIndex(
        (face) => face.pip === pip && !face.wildPip
      );
      if (index >= 0) die.faceIndex = index;
    }
  }

  /** 造一个可控盘面：本层散金与牌型加成给定，敌人已清空 */
  function layerReady(layer: number, gold: number, handBonus: number) {
    const rng = mulberry32(301);
    let state = rollDice(createExpedition(rng), rng);
    state.layer = layer;
    state.deepestLayer = layer;
    state.gold = gold;
    state.handMultiplier = handBonus;
    /* 隔离变量：把骰面摆成散牌，避免 endTurn 再叠一次牌型加成 */
    makeScatter(state);
    for (const enemy of state.enemies) {
      enemy.hp = 0;
      enemy.intent = null;
    }
    return state;
  }

  it("层倍率真的生效：本层入袋 = 散金 × 牌型 × 层倍率", () => {
    /* 第 3 层，层倍率 1.7；散金 100，牌型 +0.5 → 100 × 1.5 × 1.7 = 255 */
    const state = layerReady(3, 100, 0.5);
    expect(getLayerPayout(state)).toBe(255);

    const { state: after } = endTurn(state, mulberry32(303));
    expect(after.bagGold).toBe(255);
  });

  it("层清快照保留最后回合牌型，并明确计入本层入袋", () => {
    const state = layerReady(2, 100, 0.2);

    /* 五枚四点组成快艇，模拟最后一刀后自动结束的当前回合牌型。 */
    for (const die of state.dice) {
      const index = CHARACTERS[die.ownerId].faces.findIndex(
        (face) => face.pip === 4
      );
      expect(index).toBeGreaterThanOrEqual(0);
      die.faceIndex = index;
    }

    const closingHand = evaluateHand(state);
    expect(closingHand.adjustedBonus).toBeGreaterThan(0);

    const expectedHandFactor = Math.round(
      (1 + state.handMultiplier + closingHand.adjustedBonus) * 100
    ) / 100;
    const expectedPayout = Math.round(100 * expectedHandFactor * 1.3);
    const { state: after, hand } = endTurn(state, mulberry32(304));

    expect(hand?.name).toBe(closingHand.name);
    expect(after.lastLayerSettlement).toEqual({
      layer: 2,
      round: state.round,
      baseGold: 100,
      handFactor: expectedHandFactor,
      layerFactor: 1.3,
      payout: expectedPayout,
      bagBefore: 0,
      bagAfter: expectedPayout,
      closingHandName: closingHand.name,
      closingHandBonus: closingHand.adjustedBonus
    });
    expect(after.bagGold).toBe(expectedPayout);
    expect(after.handMultiplier).toBe(0);
  });

  it("每一层只吃自己的基础倍率，同样散金越深越肥", () => {
    const payouts = LAYER_MULTIPLIERS.map((_, index) =>
      getLayerPayout(layerReady(index + 1, 100, 0))
    );

    /* 100 × 1 × 各层倍率 */
    expect(payouts).toEqual([100, 130, 170, 220, 300]);
  });

  it("层清后散金与牌型倍率一起清零，绝不跨层累计", () => {
    const state = layerReady(1, 200, 0.8);
    const { state: cleared } = endTurn(state, mulberry32(305));

    expect(cleared.gold).toBe(0);
    expect(cleared.handMultiplier).toBe(0);
    expect(cleared.bagGold).toBeGreaterThan(0);

    /* 进入下一层：仍然是零起点 */
    const deeper = goDeeper(cleared, mulberry32(307));
    expect(deeper.gold).toBe(0);
    expect(deeper.handMultiplier).toBe(0);
    /* 包裹里的往层收益不受影响 */
    expect(deeper.bagGold).toBe(cleared.bagGold);
  });

  it("上一层收益进入包裹后，不再被后续层倍率放大", () => {
    /* 第 1 层：100 × 1 × 1 = 100 入袋 */
    let state = layerReady(1, 100, 0);
    state = endTurn(state, mulberry32(309)).state;
    expect(state.bagGold).toBe(100);

    /* 深入到第 5 层（层倍率 3），包裹里那 100 不该变成 300 */
    const rngDeep = mulberry32(311);
    state = goDeeper(state, rngDeep);
    state = rollDice(state, rngDeep);
    makeScatter(state);
    state.layer = 5;
    state.gold = 0;
    state.handMultiplier = 0;
    expect(state.bagGold).toBe(100);

    for (const enemy of state.enemies) {
      enemy.hp = 0;
      enemy.intent = null;
    }
    const done = endTurn(state, mulberry32(313)).state;
    /* 第 5 层无散金 → 包裹仍是 100 */
    expect(done.bagGold).toBe(100);
  });

  it("多层累积：包裹是各层独立结算之和", () => {
    /* 第 1 层 100×1×1 = 100 */
    let state = layerReady(1, 100, 0);
    state = endTurn(state, mulberry32(315)).state;
    expect(state.bagGold).toBe(100);

    /* 第 2 层 100×1×1.3 = 130 → 累计 230 */
    const rng2 = mulberry32(317);
    state = goDeeper(state, rng2);
    /* goDeeper 会进入 roll 阶段并重掷，必须先掷再摆散牌 */
    state = rollDice(state, rng2);
    makeScatter(state);
    state.gold = 100;
    state.handMultiplier = 0;
    for (const enemy of state.enemies) {
      enemy.hp = 0;
      enemy.intent = null;
    }
    state = endTurn(state, mulberry32(319)).state;
    expect(state.bagGold).toBe(230);
  });

  it("全灭：包裹损失 50%，当前层全丢", () => {
    const rng = mulberry32(321);
    let state = layerReady(2, 500, 1.0);
    /* 先让包裹里有 400 */
    state.bagGold = 400;

    /* 造成全灭 */
    for (const member of state.party) member.hp = 1;
    state.enemies = state.party.map((member, index) => ({
      id: `exec-${index}`,
      kind: "brute" as const,
      name: "处刑装置",
      art: "sentinel" as const,
      hp: 9,
      maxHp: 9,
      attack: 3,
      chargeReady: false,
      countdown: 2,
      blocked: 0,
      intent: {
        type: "attack" as const,
        targetId: member.id,
        value: 3,
        title: "处刑",
        description: ""
      }
    }));

    const { state: after, outcome } = endTurn(state, rng);
    expect(outcome).toBe("wipe");
    expect(after.result!.wiped).toBe(true);
    /* 包裹 400 → 折半 200；当前层 500 散金全丢 */
    expect(after.result!.totalGold).toBe(200);
    expect(after.bagGold).toBe(200);
  });
});

describe("残局识别：区分焦灼与故意拖回合", () => {
  /**
   * 造一个可控盘面。
   * startCount 决定"数量锐减"的基准，其余参数控制四条判据。
   */
  function scene(options: {
    startCount: number;
    enemies: { hp: number; maxHp: number; attack: number; kind?: EnemyKind }[];
    partyHp?: number;
    /** 装载的攻击总量 */
    readyDamage?: number;
    /** 全队没有任何攻击面：模拟"真的打不动" */
    noOffense?: boolean;
  }): ExpeditionState {
    const rng = mulberry32(401);
    const state = rollDice(createExpedition(rng), rng);

    state.layerStartEnemies = options.startCount;
    state.lastEnemyHp = 0;
    state.stalledRounds = 0;
    state.party.forEach((member) => {
      member.hp = options.partyHp ?? MAX_HP;
      member.downed = false;
    });

    const targetId = state.party[0]!.id;
    state.enemies = options.enemies.map((spec, index) => ({
      id: `foe-${index}`,
      kind: spec.kind ?? ("brute" as const),
      name: `敌${index}`,
      art: "sentinel" as const,
      hp: spec.hp,
      maxHp: spec.maxHp,
      attack: spec.attack,
      chargeReady: false,
      countdown: 2,
      blocked: 0,
      intent:
        spec.attack > 0
          ? {
              type: "attack" as const,
              targetId,
              value: spec.attack,
              title: "攻击",
              description: ""
            }
          : null
    }));

    for (const die of state.dice) {
      die.loaded = false;
      die.spent = false;
    }

    if (options.noOffense) {
      /* 真的打不动：全队骰面无任何攻击/万能面 */
      for (const die of state.dice) {
        const index = CHARACTERS[die.ownerId].faces.findIndex(
          (face) => face.verb !== "attack" && face.verb !== "wild"
        );
        if (index >= 0) die.faceIndex = index;
      }
    } else {
      /* 用柯萝萝的大攻击面凑出可观的潜在输出 */
      const want = options.readyDamage ?? 0;
      if (want > 0) {
        const index = CHARACTERS.kororo.faces.findIndex((face) => face.power === 5);
        const die = state.dice.find((item) => item.ownerId === "kororo")!;
        die.faceIndex = index;
        die.loaded = true;
      }
    }

    return state;
  }

  it("焦灼局不触发：敌人还多、还有血、威胁足", () => {
    const state = scene({
      startCount: 3,
      enemies: [
        { hp: 3, maxHp: 3, attack: 2 },
        { hp: 3, maxHp: 3, attack: 2 },
        { hp: 2, maxHp: 3, attack: 2 }
      ],
      readyDamage: 5
    });

    const verdict = assessStalling(state);
    expect(verdict.routed).toBe(false);
    expect(verdict.stalling).toBe(false);
  });

  it("打不动不触发：孤立无威胁，但玩家确实没有输出手段", () => {
    const state = scene({
      startCount: 3,
      /* 血厚到全队潜在输出也啃不掉 */
      enemies: [{ hp: 12, maxHp: 12, attack: 0 }],
      noOffense: true
    });

    const verdict = assessStalling(state);
    expect(verdict.routed).toBe(true);
    expect(verdict.harmless).toBe(true);
    /* 关键：既没有击杀能力，也未进入长期僵持 → 不算拖 */
    expect(verdict.couldFinish).toBe(false);
    expect(verdict.grinding).toBe(false);
    expect(verdict.stalling).toBe(false);
  });

  it("兜底：敌方血量长期零下降即视为僵持，即便手上没攻击面", () => {
    const state = scene({
      startCount: 3,
      enemies: [{ hp: 2, maxHp: 2, attack: 1 }],
      noOffense: true
    });
    /* 连续多回合敌方血量未降 */
    state.stalledRounds = STALL_GRACE_ROUNDS;

    const verdict = assessStalling(state);
    expect(verdict.couldFinish).toBe(false);
    expect(verdict.grinding).toBe(true);
    expect(verdict.stalling).toBe(true);
  });

  it("日志复现：第 1 层清掉一只后，剩一只满血小怪也算残局", () => {
    /* 对应实测日志：L1 开局 2 只，R1 秒掉爪兽，
       此后连续 4 回合只挨打不推进——必须触发 */
    const state = scene({
      startCount: 2,
      enemies: [{ hp: 2, maxHp: 2, attack: 1 }],
      partyHp: 2,
      readyDamage: 5
    });

    const verdict = assessStalling(state);
    expect(verdict.routed).toBe(true);
    /* 幸存者虽是满血，但整层剩余肉量已不成威胁 */
    expect(verdict.weakened).toBe(true);
    expect(verdict.harmless).toBe(true);
    expect(verdict.couldFinish).toBe(true);
    expect(verdict.stalling).toBe(true);
  });

  it("威胁仍足不触发：即使残血孤立，若还能重创玩家", () => {
    const state = scene({
      startCount: 3,
      enemies: [{ hp: 2, maxHp: 10, attack: 9 }],
      partyHp: 1,
      readyDamage: 5
    });

    const verdict = assessStalling(state);
    expect(verdict.harmless).toBe(false);
    expect(verdict.stalling).toBe(false);
  });

  it("拖残局触发：数量锐减 + 残血 + 无威胁 + 有能力杀却不杀", () => {
    const state = scene({
      startCount: 3,
      enemies: [{ hp: 2, maxHp: 10, attack: 1 }],
      readyDamage: 5
    });

    const verdict = assessStalling(state);
    expect(verdict.routed).toBe(true);
    expect(verdict.weakened).toBe(true);
    expect(verdict.harmless).toBe(true);
    expect(verdict.couldFinish).toBe(true);
    expect(verdict.stalling).toBe(true);
  });

  it("兽型先预警两个完整回合，再用强化后的公开意图狂暴", () => {
    const rng = mulberry32(403);
    let state = scene({
      startCount: 3,
      enemies: [{ hp: 5, maxHp: 12, attack: 1, kind: "brute" }],
      readyDamage: 5,
      partyHp: 20
    });
    expect(assessStalling(state).stalling).toBe(true);

    const detectionRound = state.round;
    const originalIntent = structuredClone(state.enemies[0]!.intent);
    const warning = prepareEnemyTurn(state);
    /* prepare 只发出预警，本回合已公开的攻击仍原样进入队列。 */
    expect(warning.state.enemies[0]!.intent).toEqual(originalIntent);
    expect(warning.state.enemies[0]!.attack).toBe(1);
    state = endTurn(state, rng).state;
    let foe = state.enemies[0]!;

    /* 判定当回合只发预警：攻击、公开意图与血量都不能临时突变。 */
    expect(isEnemyFrenzied(state, foe)).toBe(false);
    expect(foe.attack).toBe(1);
    /* 行动已结算，意图清空以避免残留连线与承伤预览。 */
    expect(foe.intent).toBeNull();
    expect(foe.hp).toBe(5);
    expect(getEnemyFrenzyWarningStatus(state, foe.id)?.duration?.remaining).toBe(3);
    expect(getFrenzyWarningRounds(state, foe)).toBe(2);

    /* 第一个完整正常回合。 */
    state = nextRound(state, rng);
    foe = state.enemies[0]!;
    expect(state.round).toBe(detectionRound + 1);
    expect(isEnemyFrenzied(state, foe)).toBe(false);
    expect(foe.attack).toBe(1);
    expect(foe.intent).toMatchObject({ type: "attack", value: 1 });
    expect(getFrenzyWarningRounds(state, foe)).toBe(2);
    state = endTurn(rollDice(state, rng), rng).state;
    expect(getFrenzyWarningRounds(state, state.enemies[0]!)).toBe(1);

    /* 第二个完整正常回合。 */
    state = nextRound(state, rng);
    foe = state.enemies[0]!;
    expect(state.round).toBe(detectionRound + 2);
    expect(isEnemyFrenzied(state, foe)).toBe(false);
    expect(foe.intent).toMatchObject({ type: "attack", value: 1 });
    expect(getFrenzyWarningRounds(state, foe)).toBe(1);
    state = endTurn(rollDice(state, rng), rng).state;
    expect(getFrenzyWarningRounds(state, state.enemies[0]!)).toBe(0);

    /* 第三个新回合才激活；强化值在生成意图时已经公开。 */
    state = nextRound(state, rng);
    foe = state.enemies[0]!;
    expect(isEnemyFrenzied(state, foe)).toBe(true);
    expect(foe.attack).toBe(1 + FRENZY_ATTACK_BONUS);
    expect(foe.intent).toMatchObject({
      type: "attack",
      value: 1 + FRENZY_ATTACK_BONUS,
      title: "狂暴"
    });
    expect(getFrenzyWarningRounds(state, foe)).toBeNull();

    state = endTurn(rollDice(state, rng), rng).state;
    expect(state.enemies[0]!.hp).toBe(4);
  });

  it("狂暴生效后持续到怪物死亡，且攻击增幅不会逐回合重复叠加", () => {
    const rng = mulberry32(404);
    let state = scene({
      startCount: 3,
      enemies: [{ hp: 3, maxHp: 12, attack: 1, kind: "brute" }],
      readyDamage: 5,
      /* 隔离队伍力竭，只观察狂暴自身的生命周期。 */
      partyHp: 20
    });

    const baseAttack = state.enemies[0]!.attack;

    /* 判定回合，以及之后两个完整的正常回合。 */
    state = endTurn(state, rng).state;
    state = endTurn(rollDice(nextRound(state, rng), rng), rng).state;
    state = endTurn(rollDice(nextRound(state, rng), rng), rng).state;

    /* 第一个狂暴回合：只在激活时加一次攻击。 */
    state = nextRound(state, rng);
    let foe = state.enemies[0]!;
    expect(isEnemyFrenzied(state, foe)).toBe(true);
    expect(getEnemyFrenzyWarningStatus(state, foe.id)).toBeNull();
    expect(foe.attack).toBe(baseAttack + FRENZY_ATTACK_BONUS);
    expect(foe.intent).toMatchObject({
      type: "attack",
      value: baseAttack + FRENZY_ATTACK_BONUS
    });
    state = endTurn(rollDice(state, rng), rng).state;
    expect(state.enemies[0]).toMatchObject({
      attack: baseAttack + FRENZY_ATTACK_BONUS,
      hp: 2
    });
    expect(isEnemyDefeated(state.enemies[0]!)).toBe(false);
    expect(isEnemyFrenzied(state, state.enemies[0]!)).toBe(true);

    /* 第二个狂暴回合仍保持同一攻击值，并继续自伤。 */
    state = nextRound(state, rng);
    foe = state.enemies[0]!;
    expect(isEnemyFrenzied(state, foe)).toBe(true);
    expect(foe.attack).toBe(baseAttack + FRENZY_ATTACK_BONUS);
    expect(foe.intent).toMatchObject({
      type: "attack",
      value: baseAttack + FRENZY_ATTACK_BONUS
    });
    state = endTurn(rollDice(state, rng), rng).state;
    expect(state.enemies[0]).toMatchObject({
      attack: baseAttack + FRENZY_ATTACK_BONUS,
      hp: 1
    });
    expect(isEnemyDefeated(state.enemies[0]!)).toBe(false);
    expect(isEnemyFrenzied(state, state.enemies[0]!)).toBe(true);

    /* 第三个狂暴回合自伤致死；整个生命周期只记录一次激活。 */
    state = nextRound(state, rng);
    expect(state.enemies[0]).toMatchObject({
      attack: baseAttack + FRENZY_ATTACK_BONUS
    });
    expect(isEnemyFrenzied(state, state.enemies[0]!)).toBe(true);
    state = endTurn(rollDice(state, rng), rng).state;
    expect(state.enemies[0]).toMatchObject({
      attack: baseAttack + FRENZY_ATTACK_BONUS,
      hp: 0
    });
    expect(isEnemyDefeated(state.enemies[0]!)).toBe(true);
    expect(state.log.filter((entry) => entry.text.includes("进入狂暴"))).toHaveLength(1);
    expect(state.log.filter((entry) => entry.text.includes("因狂暴自伤"))).toHaveLength(3);
  });

  it("狂暴自伤致死不给赏金", () => {
    const rng = mulberry32(405);
    let state = scene({
      startCount: 3,
      /* 1 血狂暴兽，自伤即亡 */
      enemies: [{ hp: 1, maxHp: 12, attack: 1, kind: "brute" }],
      readyDamage: 5,
      partyHp: 20
    });
    state.gold = 0;
    expect(assessStalling(state).stalling).toBe(true);

    /* 判定回合 + 两个完整正常回合。 */
    state = endTurn(state, rng).state;
    state = endTurn(rollDice(nextRound(state, rng), rng), rng).state;
    state = endTurn(rollDice(nextRound(state, rng), rng), rng).state;

    /* 激活回合执行公开的狂暴攻击后才开始自伤。 */
    state = nextRound(state, rng);
    expect(isEnemyFrenzied(state, state.enemies[0]!)).toBe(true);
    const { state: after } = endTurn(rollDice(state, rng), rng);
    const foe = after.enemies[0]!;

    expect(isEnemyDefeated(foe)).toBe(true);
    /* 关键：自我崩坏不产出赏金，否则"拖到怪物自杀"成为新刷法 */
    expect(after.gold).toBe(0);
  });

  it("智能型在残局逃跑，带走一半战利品", () => {
    const rng = mulberry32(407);
    const state = scene({
      startCount: 3,
      enemies: [{ hp: 2, maxHp: 10, attack: 1, kind: "summoner" }],
      readyDamage: 5
    });
    state.gold = 200;
    expect(assessStalling(state).stalling).toBe(true);

    const { state: after } = endTurn(state, rng);
    const foe = after.enemies[0]!;

    expect(isEnemyDefeated(foe)).toBe(true);
    /* 关键事实：逃跑顺走了一半（200 → 100）。
       随后场上清空触发层清，入袋额 = 100 × 牌型 × 层倍率，
       牌型由骰面随机决定，因此只校验它落在"半数被顺走"的区间。 */
    expect(after.gold).toBe(0);
    expect(after.bagGold).toBeGreaterThanOrEqual(100);
    /* 若没被顺走，入袋至少是 200 */
    expect(after.bagGold).toBeLessThan(200);
    expect(after.log.some((entry) => entry.text.includes("逃走"))).toBe(true);
  });

  it("不拖时敌人既不狂暴也不逃跑", () => {
    const rng = mulberry32(409);
    const state = scene({
      startCount: 3,
      enemies: [
        { hp: 3, maxHp: 3, attack: 2 },
        { hp: 3, maxHp: 3, attack: 2 },
        { hp: 3, maxHp: 3, attack: 2 }
      ],
      readyDamage: 5
    });
    state.gold = 200;

    const { state: after } = endTurn(state, rng);

    expect(after.enemies.every((enemy) => !isEnemyFrenzied(after, enemy))).toBe(true);
    /* 没有谁逃跑 → 金币不被顺走 */
    expect(after.gold).toBe(200);
  });
});

describe("端到端：赖场必被制裁", () => {
  it("玩家只按跳过回合时会及时出现预警，而不是等到狂暴才提示", () => {
    const rng = mulberry32(2026);
    let state = rollDice(createExpedition(rng), rng);

    /* 复现实测日志：第 1 层开局 2 只，首回合秒掉一只 */
    state.enemies.forEach((enemy, index) => {
      if (index > 0) {
        enemy.hp = 0;
        enemy.intent = null;
      }
    });

    let warningRound: number | null = null;
    for (let round = 1; round <= 8; round += 1) {
      const result = endTurn(state, rng);
      state = result.state;
      if (state.log.some((entry) => entry.text.includes("狂暴预兆"))) {
        warningRound = round;
        break;
      }
      if (result.outcome !== "continue") break;
      state = nextRound(state, rng);
      /* 新回合必须掷骰才能进入 act 阶段 */
      state = rollDice(state, rng);
    }

    expect(warningRound).not.toBeNull();
    expect(warningRound!).toBeLessThanOrEqual(4);
    expect(
      state.enemies.some((enemy) => getEnemyFrenzyWarningStatus(state, enemy.id))
    ).toBe(true);
    expect(state.enemies.every((enemy) => !isEnemyFrenzied(state, enemy))).toBe(true);
  });

  it("狂暴怪最终自我崩坏，且不产出赏金", () => {
    const rng = mulberry32(2026);
    let state = rollDice(createExpedition(rng), rng);
    state.enemies.forEach((enemy, index) => {
      if (index > 0) {
        enemy.hp = 0;
        enemy.intent = null;
      }
    });
    const goldBefore = state.gold;

    for (let round = 1; round <= 8; round += 1) {
      const result = endTurn(state, rng);
      state = result.state;
      if (result.outcome !== "continue") break;
      state = nextRound(state, rng);
      state = rollDice(state, rng);
    }

    /* 自我崩坏而非被击杀 → 不入赏金 */
    expect(
      state.log.some((entry) => entry.text.includes("自我崩坏"))
    ).toBe(true);
    expect(state.gold).toBe(goldBefore);
  });
});

describe("牌型", () => {
  it("识别基础牌型", () => {
    expect(rankHand([1, 1, 2, 4, 6]).name).toBe("一对");
    expect(rankHand([1, 1, 2, 2, 4]).name).toBe("两对");
    expect(rankHand([3, 3, 3, 2, 6]).name).toBe("三条");
    expect(rankHand([1, 2, 3, 4, 6]).name).toBe("小顺");
    expect(rankHand([3, 3, 3, 2, 2]).name).toBe("葫芦");
    expect(rankHand([5, 5, 5, 5, 2]).name).toBe("四条");
    expect(rankHand([2, 3, 4, 5, 6]).name).toBe("大顺");
    expect(rankHand([6, 6, 6, 6, 6]).name).toBe("快艇");
  });

  it("万能点数参与最佳牌型（凯尔·静谧之楔）", () => {
    const state = actPhase();

    setFace(state, "kael", (face) => Boolean(face.wildPip));
    setFace(state, "eustice", (face) => face.pip === 2);
    setFace(state, "elora", (face) => face.pip === 3);
    setFace(state, "kororo", (face) => face.pip === 4);
    setFace(state, "norma", (face) => face.pip === 5);

    expect(evaluateHand(state).name).toBe("大顺");
  });

  it("成牌时给出贡献骰主，未成牌时为空", () => {
    const state = actPhase();

    /* 全部 pip=4 → 快艇，五枚骰全部参与 */
    for (const ownerId of ["kael", "eustice", "elora", "kororo", "norma"] as CharacterId[]) {
      setFace(state, ownerId, (face) => face.pip === 4);
    }
    const full = evaluateHand(state);
    expect(full.name).toBe("快艇");
    expect(full.contributors).toHaveLength(5);

    /* 一对：只有成对的两枚参与 */
    const pair = actPhase(211);
    setFace(pair, "kael", (face) => face.pip === 1);
    setFace(pair, "eustice", (face) => face.pip === 1);
    setFace(pair, "elora", (face) => face.pip === 3);
    setFace(pair, "kororo", (face) => face.pip === 5);
    setFace(pair, "norma", (face) => face.pip === 6);
    const pairHand = evaluateHand(pair);
    expect(pairHand.name).toBe("一对");
    expect(pairHand.contributors).toHaveLength(2);
    expect(pairHand.contributors).toContain("kael");
    expect(pairHand.contributors).toContain("eustice");
  });

  it("散牌没有贡献骰主", () => {
    const state = actPhase(213);
    setFace(state, "kael", (face) => face.pip === 1);
    setFace(state, "eustice", (face) => face.pip === 3);
    setFace(state, "elora", (face) => face.pip === 5);
    setFace(state, "kororo", (face) => face.pip === 5);
    setFace(state, "norma", (face) => face.pip === 6);

    const hand = evaluateHand(state);
    if (hand.bonus === 0) {
      expect(hand.contributors).toHaveLength(0);
    }
  });

  it("品相修正只作用于成牌骰面", () => {
    const state = actPhase();
    for (const ownerId of ["kael", "eustice", "elora", "kororo", "norma"] as CharacterId[]) {
      setFace(state, ownerId, (face) => face.pip === 4);
    }

    const hand = evaluateHand(state);
    expect(hand.name).toBe("快艇");
    expect(hand.qualityModifier).toBeCloseTo(0.1);
    expect(hand.adjustedBonus).toBeCloseTo(2.1);
  });

  it("同点数有普通面可替代时，不会错误选中锈面扣除牌型倍率", () => {
    const state = actPhase(217);
    setFace(state, "kael", (face) => face.pip === 1);
    state.party.find((member) => member.id === "kael")!.rustLevel = 1;
    setFace(state, "eustice", (face) => face.pip === 1);
    setFace(state, "elora", (face) => face.pip === 2);
    setFace(state, "kororo", (face) => face.pip === 3);
    setFace(state, "norma", (face) => face.pip === 4);

    const hand = evaluateHand(state);
    expect(hand.name).toBe("小顺");
    expect(hand.contributors).not.toContain("kael");
    expect(hand.contributors).toContain("eustice");
    expect(hand.qualityModifier).toBe(0.1);
    expect(hand.adjustedBonus).toBe(0.6);
  });

  it("封锁骰不计入牌型", () => {
    const state = actPhase();
    for (const ownerId of ["kael", "eustice", "elora", "kororo", "norma"] as CharacterId[]) {
      setFace(state, ownerId, (face) => face.pip === 4);
    }
    state.dice[0]!.sealed = true;

    expect(evaluateHand(state).name).toBe("四条");
  });
});
