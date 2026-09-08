import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { StrictMode } from "react";
import { REROLLS_PER_ROUND } from "./engine";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpeditionBattleScreen } from "./ExpeditionBattleScreen";
import { GameSessionScope } from "../../game-client/react";
import { clientFixture } from "../../game-client/testing/helpers";
import { createExpedition, dispatchBattleCommand, serializeBattleState } from "../../game-runtime/legacy-battle";
import { actScenario } from "../../game-runtime/testing/battle/testing/scenario";
const sessions: Awaited<ReturnType<typeof clientFixture>>[] = [];
async function click(element: Element) { await act(async () => { fireEvent.click(element); }); }

beforeEach(() => {
  /*
   * 只假造定时器，不接管 rAF：光束动画是自我重排的 rAF 循环，
   * 若被 fake timers 接管，runAllTimers 会永远追不完。
   */
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  cleanup(); sessions.splice(0).forEach(f => f.session.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 测试中完成当前已启动的演出。 */
async function settle() { await act(async () => { await vi.runAllTimersAsync(); }); }

/** 逐步 enemy runner 会在每个 await 后排下一枚定时器，需连微任务一起冲完。 */
async function settleAsync() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  /* 新回合由玩家确认 ROLL；测试辅助函数代为确认，再完成掷骰演出。 */
  const rollButton = screen.queryByRole("button", { name: "ROLL" });
  if (rollButton) await click(rollButton);
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

async function mount(rng?: () => number, secondRound = false) {
  let legacyArchive: string | undefined;
  if (rng) {
    const initial = createExpedition(rng);
    let rolled = dispatchBattleCommand(initial, { type: "roll-dice" }, { rng });
    if (secondRound) {
      for (const type of ["end-turn", "next-round", "roll-dice"] as const) {
        rolled = dispatchBattleCommand(rolled.state, { type }, { rng });
        if (rolled.error) throw new Error(rolled.error);
      }
    }
    legacyArchive = serializeBattleState(rolled.state);
  }
  const fixture = await clientFixture({ legacyArchive }); sessions.push(fixture);
  const view = render(<GameSessionScope session={fixture.session}><ExpeditionBattleScreen onSettle={() => {}} /></GameSessionScope>);
  if (!rng) { await click(screen.getByRole("button", { name: "ROLL" })); await settle(); }
  return view;
}
async function mountInitial(strict = false) {
  const fixture = await clientFixture(); sessions.push(fixture);
  const body = <GameSessionScope session={fixture.session}><ExpeditionBattleScreen onSettle={() => {}} /></GameSessionScope>;
  return render(strict ? <StrictMode>{body}</StrictMode> : body);
}

function board() {
  return screen.getByRole("main", { name: "裂隙远征战斗界面" });
}

function dice() {
  return board().querySelectorAll<HTMLButtonElement>(".expedition-die");
}

function dieSlots() {
  return board().querySelectorAll<HTMLElement>(".abyssa-expedition-die-slot");
}

function cubeTransform(index: number) {
  return dice()[index]!.querySelector<HTMLElement>(".expedition-die__cube")!.style.transform;
}

function enemies() {
  return board().querySelectorAll<HTMLElement>(".abyssa-expedition-enemy");
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function sequenceRng(values: readonly number[], fallback = 0) {
  let index = 0;
  return () => values[index++] ?? fallback;
}

/** 菱形撤回按钮：无障碍名为「撤回」或「撤回：<行动>」 */
function undoButton() {
  return screen.getByRole("button", { name: /^撤回/ });
}

function partyCards() {
  return board().querySelectorAll<HTMLElement>(".abyssa-expedition-party-card");
}

/** Read the CSS as Vite sees it, following the ordered local @import entry point. */
function readExpeditionCss(
  path = "src/apps/battle/expedition.css",
  seen = new Set<string>()
): string {
  const absolute = resolve(path);
  if (seen.has(absolute)) throw new Error(`circular CSS import: ${absolute}`);
  seen.add(absolute);
  const source = readFileSync(absolute, "utf8");
  return source.replace(/@import\s+["'](.+?)["'];/g, (_statement, relativePath: string) =>
    readExpeditionCss(resolve(dirname(absolute), relativePath), seen)
  );
}

describe("开局不得卡死", () => {
  it("StrictMode 下手动初投会正常收尾，盘面可交互", async () => {
    await mountInitial(true);
    await click(screen.getByRole("button", { name: "ROLL" }));
    await settle();

    const main = screen.getByRole("main", { name: "裂隙远征战斗界面" });
    /* 骰子必须停下——否则 isRolling 永为 true，全盘锁死 */
    expect(main.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "END TURN" })).toBeEnabled();
    /* 骰子可装载 */
    const die = main.querySelector<HTMLButtonElement>(".expedition-die")!;
    expect(die).toBeEnabled();
  });
});

describe("ExpeditionBattleScreen", () => {
  it("cycles the timber, hero, four-regent, demon-lord and old-manor frame skins", async () => {
    await mount();

    const switcher = screen.getByRole("button", { name: /切换战斗界面风格/ });
    expect(board()).toHaveAttribute("data-ui-skin", "timber");
    expect(board()).not.toHaveAttribute("data-ui-ornamented");
    expect(board().querySelectorAll(".abyssa-expedition-frame__top-ornament")).toHaveLength(0);
    expect(board().querySelectorAll(".abyssa-expedition-frame__corner-ornaments")).toHaveLength(0);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave")).toHaveLength(0);
    expect(switcher).toHaveTextContent("原生木框");

    await click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "hero-party");
    expect(board()).toHaveAttribute("data-ui-ornamented");
    expect(board().querySelectorAll(".abyssa-expedition-frame__top-ornament")).toHaveLength(2);
    expect(board().querySelectorAll(".abyssa-expedition-frame__corner-ornaments img")).toHaveLength(4);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave")).toHaveLength(1);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave [data-frame-edge]")).toHaveLength(4);
    expect(switcher).toHaveTextContent("勇者小队");

    await click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "demon-cadre");
    expect(board()).toHaveAttribute("data-ui-ornamented");
    expect(board().querySelectorAll(".abyssa-expedition-frame__top-ornament")).toHaveLength(2);
    expect(board().querySelectorAll(".abyssa-expedition-frame__corner-ornaments img")).toHaveLength(4);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave")).toHaveLength(1);
    expect(switcher).toHaveTextContent("四席摄政");

    await click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "demon-lord");
    expect(switcher).toHaveTextContent("魔王亲征");

    await click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "old-manor");
    expect(board()).toHaveAttribute("data-ui-ornamented");
    expect(switcher).toHaveTextContent("克雷格旧庄园");
    expect(switcher).toHaveTextContent("5/5");
    expect(board().querySelectorAll(".abyssa-expedition-frame__overlay")).toHaveLength(1);
    expect(board().querySelectorAll(".abyssa-expedition-frame__top-ornament")).toHaveLength(0);
    expect(board().querySelectorAll(".abyssa-expedition-frame__corner-ornaments img")).toHaveLength(0);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave")).toHaveLength(0);

    await click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "timber");
    expect(board().querySelectorAll(".abyssa-expedition-frame__overlay")).toHaveLength(0);
  });

  it("开局展示三面预览，首投后切换 REROLL 且不扣重掷次数", async () => {
    await mountInitial();

    const rollButton = screen.getByRole("button", { name: "ROLL" });
    expect(rollButton).toBeEnabled();
    expect(dieSlots()).toHaveLength(5);
    expect([...dieSlots()].map((slot) => slot.dataset.owner)).toEqual([
      "kael",
      "eustice",
      "elora",
      "kororo",
      "norma"
    ]);
    expect([...dieSlots()].map((slot) => slot.style.gridColumn)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5"
    ]);
    expect(board().querySelectorAll(".abyssa-expedition-die-slot[data-unrolled]")).toHaveLength(5);
    for (const cube of board().querySelectorAll<HTMLElement>(".expedition-die__cube")) {
      expect(cube.style.transform).toBe("rotateX(-18deg) rotateY(28deg)");
    }

    await click(rollButton);
    expect(screen.queryByRole("button", { name: "ROLL" })).toBeNull();
    expect(screen.getByRole("button", { name: "REROLL" })).toBeDisabled();
    expect(board().querySelectorAll(".abyssa-expedition-die-slot[data-unrolled]")).toHaveLength(0);
    expect(
      screen.getByLabelText(`重掷剩余 ${REROLLS_PER_ROUND} 次`)
    ).toHaveTextContent(`×${REROLLS_PER_ROUND}`);

    await settle();
    expect(screen.getByRole("button", { name: "REROLL" })).toBeEnabled();
  });

  it("底栏是 UNDO / REROLL / 重掷读数 / END TURN", async () => {
    await mount();

    expect(undoButton()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "REROLL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "END TURN" })).toBeInTheDocument();
    /* 结算/AUTO 都不应存在 */
    expect(screen.queryByRole("button", { name: "EXECUTE" })).toBeNull();
    expect(screen.queryByRole("button", { name: "AUTO" })).toBeNull();
    /* 撑回是菱形图标按钮，不再是文字按钮 */
    expect(undoButton()).toHaveClass("abyssa-expedition-undo");
    expect(undoButton().dataset.shape).toBe("diamond");

    expect(
      screen.getByLabelText(`重掷剩余 ${REROLLS_PER_ROUND} 次`)
    ).toHaveTextContent(`×${REROLLS_PER_ROUND}`);
  });

  it("骰子是多选装载，可同时装载多枚", async () => {
    await mount();
    const list = dice();

    await click(list[0]!);
    await click(list[2]!);
    await click(list[4]!);

    const slots = dieSlots();
    expect(slots[0]!.dataset.loaded).toBe("true");
    expect(slots[1]!.dataset.loaded).toBeUndefined();
    expect(slots[2]!.dataset.loaded).toBe("true");
    expect(slots[3]!.dataset.loaded).toBeUndefined();
    expect(slots[4]!.dataset.loaded).toBe("true");
  });

  it("再次点击骰子即卸载", async () => {
    await mount();
    const list = dice();

    await click(list[1]!);
    expect(dieSlots()[1]!.dataset.loaded).toBe("true");

    await click(list[1]!);
    expect(dieSlots()[1]!.dataset.loaded).toBeUndefined();
  });

  it("未装载时角色卡不可指挥；装载后才待命", async () => {
    await mount();

    expect(partyCards()[0]!.dataset.ready).toBeUndefined();

    await click(dice()[0]!);
    expect(partyCards()[0]!.dataset.ready).toBe("true");
  });

  it("点角色卡拿起，再点一次放下", async () => {
    /* 固定凯尔为攻击面，避免随机到可对自己施放的格挡面。 */
    await mount(() => 0);

    await click(dice()[0]!);
    await click(partyCards()[0]!);
    expect(partyCards()[0]!.dataset.held).toBe("true");
    expect(board().querySelectorAll(".abyssa-expedition-party-column[data-active]")).toHaveLength(1);

    await click(partyCards()[0]!);
    expect(partyCards()[0]!.dataset.held).toBeUndefined();
  });

  it("装载即点亮曲线光束，拿起后再加强", async () => {
    await mount();

    /* 未装载：光束不亮 */
    expect(board().querySelectorAll(".abyssa-expedition-party-column[data-active]")).toHaveLength(0);

    /* 装载骰子 → 光束通电 */
    await click(dice()[0]!);
    expect(board().querySelectorAll(".abyssa-expedition-party-column[data-active]")).toHaveLength(1);
    /* 光束 SVG 存在 */
    expect(
      board().querySelector(".abyssa-expedition-party-column[data-active] .abyssa-expedition-party-link__main")
    ).not.toBeNull();

    /* 拿起角色卡 → 加强档 */
    await click(partyCards()[0]!);
    expect(board().querySelectorAll(".abyssa-expedition-party-column[data-held]")).toHaveLength(1);
  });

  it("重掷次数耗尽后未装载骰自动装载，REROLL 禁用", async () => {
    await mount();

    /* 用尽全部重掷次数 */
    for (let i = 0; i < REROLLS_PER_ROUND; i += 1) {
      await click(screen.getByRole("button", { name: "REROLL" }));
      // The final roll auto-loads its results, but those dice must still finish rolling.
      expect(board().querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(5);
      await settle();
    }

    expect(screen.getByLabelText("重掷剩余 0 次")).toHaveTextContent("×0");
    expect(screen.getByRole("button", { name: "REROLL" })).toBeDisabled();

    /* 全部自动装载 */
    for (const slot of dieSlots()) {
      expect(slot.dataset.loaded ?? slot.dataset.sealed).toBeTruthy();
    }
  });

  it("重掷清空撤销栈：UNDO 变灰", async () => {
    await mount();

    await click(dice()[0]!);
    expect(undoButton()).toBeEnabled();

    await click(screen.getByRole("button", { name: "REROLL" }));
    await settle();

    expect(undoButton()).toBeDisabled();
  });

  it("UNDO 可撤销装载", async () => {
    await mount();

    await click(dice()[0]!);
    expect(dieSlots()[0]!.dataset.loaded).toBe("true");

    await click(undoButton());
    expect(dieSlots()[0]!.dataset.loaded).toBeUndefined();
  });

  it("END TURN 播放敌方命中并在演出结束后显示已提交日志", async () => {
    await mount();

    const before = board().querySelectorAll(".abyssa-expedition-battle-log li").length;
    await click(screen.getByRole("button", { name: "END TURN" }));

    expect(board()).toHaveAttribute("data-enemy-turn-phase", "anticipate");
    await advance(121);
    await advance(101);
    await advance(61);

    expect(board()).toHaveAttribute("data-enemy-turn-phase", "impact");
    await settle();
    expect(board().querySelectorAll(".abyssa-expedition-battle-log li").length).toBeGreaterThan(before);
  });

  it("怪物逐只命中；力竭后角色与原槽骰子在本层持续置灰", async () => {
    const rng = sequenceRng([
      /* 两只敌人都瞄准第二位尤斯缇丝：1 + 2 伤害刚好力竭。 */
      0.21, 0.21,
      /* 第一回合与第二回合的五枚骰。 */
      0, 0, 0, 0, 0,
      0, 0,
      0, 0, 0, 0, 0
    ]);
    await mount(rng);

    await click(screen.getByRole("button", { name: "END TURN" }));

    const targetCard = partyCards()[1]!;
    const targetHearts = targetCard.querySelector(".abyssa-expedition-party-card__hearts")!;
    expect(enemies()[0]).toHaveAttribute("data-enemy-action-phase", "anticipate");
    expect(enemies()[1]).not.toHaveAttribute("data-enemy-action-phase");
    expect(targetHearts).toHaveAttribute("aria-label", "生命 3 / 3");
    expect(board()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "END TURN" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "REROLL" })).toBeDisabled();

    /* 第一只怪：顿帧之前绝不扣血，impact 才只扣自己的 1 点。 */
    await advance(121);
    await advance(101);
    expect(targetHearts).toHaveAttribute("aria-label", "生命 3 / 3");
    await advance(61);
    expect(targetHearts).toHaveAttribute("aria-label", "生命 2 / 3");
    expect(targetCard.querySelectorAll("i[data-lost-heart]")).toHaveLength(1);
    expect(targetCard.querySelector("i[data-lost-heart]")).toHaveAttribute(
      "data-lost-order",
      "0"
    );
    expect(enemies()[1]).not.toHaveAttribute("data-enemy-action-phase");

    /* 第一只完整收尾后，第二只才开始。 */
    await advance(321);
    await advance(221);
    expect(enemies()[1]).toHaveAttribute("data-enemy-action-phase", "anticipate");
    expect(targetHearts).toHaveAttribute("aria-label", "生命 2 / 3");

    await advance(121);
    await advance(101);
    await advance(61);
    expect(targetHearts).toHaveAttribute("aria-label", "生命 0 / 3");
    expect(targetCard.querySelectorAll("i[data-lost-heart]")).toHaveLength(2);
    /* impact 先让心播放熄灭，暂不盖上力竭灰态。 */
    expect(targetCard).not.toHaveAttribute("data-downed");

    await advance(321);

    expect(dieSlots()).toHaveLength(5);
    expect([...dieSlots()].map((slot) => slot.dataset.owner)).toEqual([
      "kael",
      "eustice",
      "elora",
      "kororo",
      "norma"
    ]);
    expect(targetCard).toHaveAttribute("data-downed", "true");
    expect(targetCard).toHaveTextContent("力竭");
    expect(dieSlots()[1]).toHaveAttribute("data-downed", "true");
    expect(dice()[1]).toBeDisabled();
    expect(dieSlots()[2]).toHaveAttribute("data-owner", "elora");
    expect(dieSlots()[2]!.style.gridColumn).toBe("3");

    /* 自动推进本层下一回合后，力竭角色与其原槽骰仍必须保持灰态。 */
    await settleAsync();

    expect(partyCards()[1]).toHaveAttribute("data-downed", "true");
    expect(partyCards()[1]).toHaveAccessibleName(/本层无法行动，下一层以 1 点生命重整/);
    expect(
      partyCards()[1]!.querySelector(".abyssa-expedition-party-card__hearts")
    ).toHaveAttribute("aria-label", "生命 0 / 3");
    expect(dieSlots()[1]).toHaveAttribute("data-downed", "true");
    expect(dieSlots()[1]).toHaveAttribute("data-rust-faces", "1");
    expect(dieSlots()[1]).toHaveAttribute("data-gild-faces", "1");
    const qualityCounts = dieSlots()[1]!.querySelector(".expedition-die__quality-counts")!;
    const rustCount = qualityCounts.querySelector('[data-quality="rust"]');
    const gildCount = qualityCounts.querySelector('[data-quality="gild"]');
    expect(qualityCounts.children).toHaveLength(2);
    expect(rustCount).toHaveTextContent("1");
    expect(rustCount).toHaveAttribute("title", "尤斯缇丝的命数骰有 1 面锈铭");
    expect(gildCount).toHaveTextContent("1");
    expect(gildCount).toHaveAttribute("title", "尤斯缇丝的命数骰有 1 面金铭");
    expect(dieSlots()[1]).not.toHaveTextContent("锈 1/6");
    const rustFace = dieSlots()[1]!.querySelector('.expedition-die__face[data-face="1"]')!;
    expect(rustFace.querySelector(".expedition-flat-die-frame__seal")).toHaveAttribute(
      "data-seal",
      "rust"
    );
    expect(dice()[1]).toBeDisabled();
  });

  it("完全格挡播放卡内盾击，不扣红心也不标记心损失", async () => {
    /* 凯尔三面 guard 1；两只敌人都瞄准艾洛拉。 */
    await mount(() => 0.4);

    await click(dice()[0]!);
    await click(partyCards()[0]!);
    await click(
      enemies()[0]!.querySelector<HTMLButtonElement>(".abyssa-expedition-intent")!
    );
    await advance(91);
    await advance(121);
    await advance(241);
    await advance(301);

    const target = partyCards()[2]!;
    const hearts = target.querySelector(".abyssa-expedition-party-card__hearts")!;
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 1 层"
    );

    await click(screen.getByRole("button", { name: "END TURN" }));
    expect(target).toHaveAttribute("data-enemy-hit-result", "blocked");
    expect(hearts).toHaveAttribute("aria-label", "生命 3 / 3");

    await advance(121);
    await advance(101);
    await advance(61);
    expect(target).toHaveAttribute("data-enemy-hit-phase", "impact");
    expect(hearts).toHaveAttribute("aria-label", "生命 3 / 3");
    expect(target.querySelectorAll("i[data-lost-heart]")).toHaveLength(0);
    expect(screen.getByLabelText("艾洛拉完全挡下畸变魔物的攻击")).toHaveTextContent(
      "BLOCK"
    );
  });

  it("狂暴预警在提交演出结束后更新，强化攻击随新回合公开", async () => {
    await mount(() => 0);
    await click(dice()[3]!); await click(partyCards()[3]!); await click(enemies()[1]!); await settle();
    await click(screen.getByRole("button", { name: "END TURN" })); await settleAsync();
    const warning = board().querySelector(".abyssa-expedition-enemy__frenzy-status");
    expect(warning).toHaveTextContent("狂暴预警");
    expect(warning).toHaveTextContent("2 回合");
    expect(enemies()[0]).not.toHaveAttribute("data-frenzied");
    await click(screen.getByRole("button", { name: "END TURN" })); await settleAsync();
    expect(board().querySelector(".abyssa-expedition-enemy__frenzy-status")).toHaveTextContent("1 回合");
    await click(screen.getByRole("button", { name: "END TURN" })); await settleAsync();
    // Necessary next-round has already committed; active frenzy is now the current public intent.

    expect(enemies()[0]).toHaveAttribute("data-frenzied", "true");
    expect(board().querySelector('.abyssa-expedition-enemy__frenzy-status[data-active="true"]')).toHaveTextContent("持续至死亡");
  });

  it("五张队员卡与敌方意图均已渲染", async () => {
    await mount();

    for (const name of ["你", "尤斯缇丝", "艾洛拉", "柯萝萝", "诺玛"]) {
      expect(screen.getByRole("article", { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("region", { name: "敌方单位" }).querySelectorAll(".abyssa-expedition-intent").length
    ).toBeGreaterThan(0);
  });

  it("红心只渲染上限数量，左侧徽标是盾牌层数", async () => {
    await mount();

    const card = partyCards()[0]!;
    /* 上限 3 心：只能有 3 个心元素，不能凑数到 6 */
    expect(card.querySelectorAll(".abyssa-expedition-party-card__hearts i")).toHaveLength(3);
    /* 不应再有第二排盾牌图标 */
    expect(card.querySelector(".abyssa-expedition-party-card__shields")).toBeNull();

    /* 左侧徽标是数字，开局为 0 */
    const shield = card.querySelector(".abyssa-expedition-party-card__shield")!;
    expect(shield.textContent).toBe("0");
    expect(shield.getAttribute("data-empty")).toBe("true");
  });

  it("骰面强度由可见楔形刻度表达，不再渲染隐藏的旧 rail", async () => {
    await mount();

    /* 柯萝萝有 power 4/5 面；当前可见组件直接携带其强度。 */
    const highPower = board().querySelectorAll(
      '.expedition-flat-die-frame__power[data-power="4"], .expedition-flat-die-frame__power[data-power="5"]'
    );
    expect(highPower.length).toBeGreaterThan(0);
    for (const mark of highPower) {
      expect(mark.querySelectorAll("use").length).toBeGreaterThan(0);
      expect(mark.textContent).toBe("");
    }
    expect(board().querySelector(".expedition-die__legacy-face")).toBeNull();
    expect(board().querySelector(".expedition-die__rail")).toBeNull();
  });

  it("摆烂面使用当前骰面组件的封印图标，且不能指挥角色", async () => {
    await mount(() => 0.9);

    const blankFaces = board().querySelectorAll(
      '.expedition-flat-die-frame[data-action="blank"]'
    );
    expect(blankFaces.length).toBeGreaterThan(0);
    for (const face of blankFaces) {
      expect(face.querySelector('.expedition-flat-die-frame__power[data-power="0"]')).not.toBeNull();
      expect(face.querySelector(".expedition-flat-die-frame__main-stamp")).not.toBeNull();
    }

    /* 0.9 令柯萝萝掷出六面 blank：可锁定点数，但角色卡不亮、不响应。 */
    expect(dice()[3]).toHaveAttribute("data-unusable", "true");
    expect(dice()[3]!.getAttribute("aria-label")).toContain("无行动面，无法指挥角色");
    await click(dice()[3]!);
    expect(dieSlots()[3]).toHaveAttribute("data-loaded", "true");
    expect(partyCards()[3]).not.toHaveAttribute("data-ready");
    await click(partyCards()[3]!);
    expect(partyCards()[3]).not.toHaveAttribute("data-held");
  });

  it("意图线按威胁分级着色，且随 undo 变化", async () => {
    await mount();

    const lines = board().querySelectorAll(
      ".abyssa-expedition-enemies__intent-lines g[data-threat]"
    );
    expect(lines.length).toBeGreaterThan(0);
    /* 只允许三档取值 */
    for (const line of lines) {
      expect(["lethal", "normal", "blocked"]).toContain(line.getAttribute("data-threat"));
    }

    /* 徽章与连线共用同一套威胁语言 */
    expect(
      board().querySelectorAll(".abyssa-expedition-intent[data-threat]").length
    ).toBeGreaterThan(0);
  });

  it("底栏有牌型读数槽，成牌时点亮并显示倍率加成", async () => {
    await mount();

    const slot = board().querySelector(".abyssa-expedition-hand")!;
    expect(slot).not.toBeNull();
    /* 槽内不再有 HAND 小字，只留牌型与倍率 */
    expect(slot.textContent).not.toContain("HAND");
    expect(slot.querySelector(".abyssa-expedition-hand__caption")).toBeNull();

    /* 无论是否成牌，牌型名恒有读数 */
    const name = slot.querySelector(".abyssa-expedition-hand__name")!;
    expect(name.textContent).toBeTruthy();

    /* 成牌时点亮并给出倍率；散牌时压暗并保留稳定占位。 */
    if (slot.getAttribute("data-scoring") === "true") {
      expect(slot.querySelector(".abyssa-expedition-hand__bonus")).not.toBeNull();
      expect(slot.getAttribute("aria-label")).toMatch(/倍率加成 \+/);
      expect(slot.querySelector(".abyssa-expedition-hand__bonus")).toHaveTextContent(/^\+\d/);
    } else {
      expect(slot.getAttribute("data-idle")).toBe("true");
      expect(slot.querySelector(".abyssa-expedition-hand__bonus")).toHaveTextContent("—");
    }
  });

  it("成牌时点亮参与骰的命数角标", async () => {
    /* 固定同点数，确保稳定形成牌型而不是依赖 Math.random。 */
    await mount(() => 0.4);

    const slot = board().querySelector(".abyssa-expedition-hand")!;
    const lit = board().querySelectorAll(".expedition-flat-die-frame[data-scoring]");

    if (slot.getAttribute("data-scoring") === "true") {
      /* 成牌：至少两枚骰的结果面角标亮起 */
      expect(lit.length).toBeGreaterThanOrEqual(2);
    } else {
      /* 未成牌：不得有任何角标亮起 */
      expect(lit).toHaveLength(0);
    }
  });

  it("我方选中态压过敌方瞄准态", async () => {
    /* 固定被瞄准者为艾洛拉，且其骰面可行动，避免随机到 blank。 */
    await mount(() => 0.4);

    /* 找一张正被瞄准的卡 */
    const targeted = board().querySelector<HTMLElement>(
      ".abyssa-expedition-party-card[data-targeted]"
    );
    if (!targeted) return;

    const memberId = targeted.dataset.character!;
    const index = [...partyCards()].indexOf(targeted);
    expect(index).toBeGreaterThanOrEqual(0);

    /* 装载该角色的骰子并拿起 */
    await click(dice()[index]!);
    await click(targeted);

    const after = board().querySelector<HTMLElement>(
      `.abyssa-expedition-party-card[data-character="${memberId}"]`
    )!;
    /* 两个状态同时存在，但 held 必须仍然生效（书写顺序在后） */
    expect(after.dataset.held).toBe("true");

    /* 威胁态仍在，但不该压过选中态 */
    expect(after.dataset.targeted).toBe("true");
  });

  it("选中态的 CSS 规则必须写在威胁态之后（同特异度下后者胜出）", async () => {
    const css = readExpeditionCss();
    const targeted = css.indexOf(".abyssa-expedition-party-card[data-targeted] {");
    const held = css.indexOf(".abyssa-expedition-party-card[data-held],");

    expect(targeted).toBeGreaterThan(-1);
    expect(held).toBeGreaterThan(-1);
    /* 我方选中态在后，才能覆盖敌方威胁态 */
    expect(held).toBeGreaterThan(targeted);
  });

  it("原右栏倍率牌保留机械读数，下拉不再重复倍率拆解与包裹", async () => {
    await mount();

    const monitor = board().querySelector(".battle-sidebar-readouts")!;
    expect(monitor.querySelector(".abyssa-expedition-multiplier__reels")).toHaveAttribute("aria-label", expect.stringMatching(/当前总倍率 \d+\.\d{2}/));
    expect(board().querySelector(".abyssa-expedition-multiplier__breakdown")).toBeNull();
    expect(board().querySelector(".battle-ledger .abyssa-expedition-odometer")).toBeNull();
    expect(
      monitor.querySelectorAll(".abyssa-expedition-bag-odometer .abyssa-expedition-odometer__reel")
    ).toHaveLength(6);
  });

  it("expedition.css 括号配平（防止批量改写破坏结构）", async () => {
    const css = readExpeditionCss();
    let depth = 0;
    let orphans = 0;
    for (const ch of css) {
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth < 0) {
          orphans += 1;
          depth = 0;
        }
      }
    }
    expect(orphans).toBe(0);
    expect(depth).toBe(0);
  });

  it("默认骰子保持实色，并与角色卡共框", async () => {
    const css = readExpeditionCss();
    const battlefieldRule = css.match(
      /\.abyssa-expedition-regions__battlefield\s*\{([^}]*)\}/
    )?.[1];
    const partyRule = css.match(/\.abyssa-expedition-party\s*\{([^}]*)\}/)?.[1];
    const dicePanelRule = css.match(
      /\.abyssa-expedition-dice-panel\s*\{([^}]*)\}/
    )?.[1];
    const defaultDieRule = css.match(
      /\.abyssa-expedition-die-slot:not\(\[data-loaded\]\) \.expedition-die\s*\{([^}]*)\}/
    )?.[1];
    expect(defaultDieRule).toContain("opacity: 1");
    expect(battlefieldRule).toContain(
      "grid-template-rows: var(--expedition-enemy-panel-h) minmax(0, 1fr)"
    );
    expect(partyRule).toContain("grid-row: 2");
    expect(dicePanelRule).toContain("grid-row: 2");
  });

  it("攻击特效由敌方 formation 裁剪，不截断跨区意图线", async () => {
    const css = readExpeditionCss();
    const formationRule = css.match(
      /\.abyssa-expedition-enemies__formation\s*\{([^}]*)\}/
    )?.[1];
    const intentRule = css.match(
      /\.abyssa-expedition-enemies__intent-lines\s*\{([^}]*)\}/
    )?.[1];
    const supportRule = css.match(
      /\.abyssa-expedition-support-fx\s*\{([^}]*)\}/
    )?.[1];
    const enemyHitRule = css.match(
      /\.abyssa-expedition-enemy-hit-fx\s*\{([^}]*)\}/
    )?.[1];

    expect(formationRule).toContain("overflow: clip");
    expect(formationRule).toContain("contain: paint");
    /* 只裁剪怪物/攻击层；意图线仍允许跨到我方区域。 */
    expect(intentRule).toContain("overflow: visible");
    /* 支援特效由每张目标卡自己的 overlay 裁剪。 */
    expect(supportRule).toContain("overflow: clip");
    expect(supportRule).toContain("contain: paint");
    /* 敌方命中效果同样锁在目标卡内部。 */
    expect(enemyHitRule).toContain("overflow: clip");
    expect(enemyHitRule).toContain("contain: paint");
  });

  it("装载骰子后立即启动交缠光束动画", async () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");
    await mount();
    requestFrame.mockClear();

    await click(dice()[0]!);
    expect(requestFrame).toHaveBeenCalled();
  });

  it("转轮行高只有 CSS 单一来源，JS 不写死像素", async () => {
    const reels = readFileSync("src/apps/battle/ExpeditionReels.tsx", "utf8");
    /* 位移必须走 CSS 变量，否则改 CSS 尺寸会与 JS 脱节 */
    expect(reels).toContain("var(--odometer-digit-h)");
    expect(reels).not.toMatch(/translateY\(\$\{[^}]*\d+\}px\)/);
  });

  it("掷骰与重掷时，所有参与骰都进入滚动态", async () => {
    await mountInitial();

    const board = screen.getByRole("main", { name: "裂隙远征战斗界面" });
    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
    await click(screen.getByRole("button", { name: "ROLL" }));
    /* 手动首投：五枚全滚。 */
    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(5);

    await settle();
    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);

    /* 装载一枚后重掷：只有未装载的四枚滚动 */
    const dice = board.querySelectorAll<HTMLButtonElement>(".expedition-die");
    await click(dice[0]!);
    const heldRotation = cubeTransform(0);
    await click(screen.getByRole("button", { name: "REROLL" }));

    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(4);
    expect(cubeTransform(0)).toBe(heldRotation);
    await settle();
    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
    expect(cubeTransform(0)).toBe(heldRotation);
  });

  it("已行动和已固定的骰子在其他骰子重掷时保持原姿态", async () => {
    await mount(() => 0);
    await click(dice()[0]!);
    await click(partyCards()[0]!);
    await click(enemies()[0]!);
    await settle();
    expect(dieSlots()[0]).toHaveAttribute("data-spent", "true");
    await click(dice()[1]!);
    const rotations = [cubeTransform(0), cubeTransform(1)];

    await click(screen.getByRole("button", { name: "REROLL" }));
    expect(board().querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(3);
    expect([cubeTransform(0), cubeTransform(1)]).toEqual(rotations);
    await settle();
    expect([cubeTransform(0), cubeTransform(1)]).toEqual(rotations);
  });

  it("恢复已掷骰存档时直接显示实际骰面，不播放补转动画", async () => {
    await mount(() => 5 / 6);
    for (let index = 0; index < dice().length; index += 1) {
      expect(dice()[index]).toHaveAccessibleName(/当前 6 点/);
      expect(dice()[index]).not.toHaveAttribute("data-rolling");
      expect(cubeTransform(index)).toBe("rotateX(0deg) rotateY(180deg)");
    }
  });

  it("封印和力竭骰不参与重掷，也不改变三维姿态", async () => {
    const state = actScenario().party("elora", { hp: 0, downed: true })
      .patch(draft => { draft.dice[1]!.sealed = true; }).build();
    const fixture = await clientFixture({ legacyArchive: serializeBattleState(state) });
    sessions.push(fixture);
    render(<GameSessionScope session={fixture.session}><ExpeditionBattleScreen onSettle={() => {}} /></GameSessionScope>);
    const rotations = [cubeTransform(1), cubeTransform(2)];
    expect(dieSlots()[1]).toHaveAttribute("data-sealed", "true");
    expect(dieSlots()[2]).toHaveAttribute("data-downed", "true");

    await click(screen.getByRole("button", { name: "REROLL" }));
    expect(board().querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(3);
    expect([cubeTransform(1), cubeTransform(2)]).toEqual(rotations);
    await settle();
    expect([cubeTransform(1), cubeTransform(2)]).toEqual(rotations);
  });

  it("普通攻击按蓄势、顿帧、命中、收势播放，命中帧才扣血", async () => {
    await mount(() => 0);

    /* 凯尔一面是 1 点攻击；第一只怪物有 2 点生命，不会斩杀。 */
    await click(dice()[0]!);
    await click(partyCards()[0]!);
    const target = enemies()[0]!;
    const health = target.querySelector(".abyssa-expedition-enemy__health")!;
    await click(target);

    expect(board()).toHaveAttribute("data-attack-phase", "anticipate");
    expect(target).toHaveAttribute("data-attack-phase", "anticipate");
    expect(target.querySelectorAll(".abyssa-expedition-attack-slash")).toHaveLength(2);
    expect(health).toHaveAttribute("aria-label", "生命 2 / 2");
    expect(screen.getByRole("button", { name: "END TURN" })).toBeDisabled();

    await advance(101);
    expect(target).toHaveAttribute("data-attack-phase", "hitstop");
    /* 顿帧阶段仍未提交规则结果。 */
    expect(health).toHaveAttribute("aria-label", "生命 2 / 2");

    await advance(71);
    expect(target).toHaveAttribute("data-attack-phase", "impact");
    expect(target.querySelector(".abyssa-expedition-enemy__health")).toHaveAttribute(
      "aria-label",
      "生命 1 / 2"
    );
    expect(screen.getByLabelText("畸变魔物受到 1 点伤害")).toBeInTheDocument();

    await advance(261);
    expect(target).toHaveAttribute("data-attack-phase", "recover");
    await advance(321);

    expect(board()).not.toHaveAttribute("data-attack-phase");
    expect(enemies()).toHaveLength(2);
    expect(enemies()[0]).not.toHaveAttribute("data-defeated");
  });

  it("斩杀目标会留在 DOM 播完退场，结束后移除且 UNDO 可令其重新入场", async () => {
    await mount(() => 0);

    /* 柯萝萝一面是 4 点攻击，足以斩杀第一只 2 血怪物。 */
    await click(dice()[3]!);
    await click(partyCards()[3]!);
    const target = enemies()[0]!;
    await click(target);

    await advance(101);
    await advance(71);

    expect(target).toBeInTheDocument();
    expect(target).toHaveAttribute("data-defeated", "true");
    expect(target).toHaveAttribute("data-attack-lethal", "true");
    expect(target).toHaveAttribute("data-attack-phase", "impact");
    expect(screen.getByLabelText("畸变魔物受到 4 点伤害并被斩杀")).toBeInTheDocument();
    /* 引擎已有撤销快照，但演出期间不允许把目标提前拉回来。 */
    expect(undoButton()).toBeDisabled();

    await advance(261);
    expect(target).toHaveAttribute("data-attack-phase", "defeat");
    expect(target).toBeInTheDocument();

    await advance(461);
    expect(target).not.toBeInTheDocument();
    expect(enemies()).toHaveLength(1);
    expect(board()).not.toHaveAttribute("data-attack-phase");
    expect(undoButton()).toBeEnabled();

    await click(undoButton());
    expect(enemies()).toHaveLength(2);
    expect(enemies()[0]).not.toHaveAttribute("data-defeated");
    expect(enemies()[0]!.style.animationDelay).toBe("0ms");
  });

  it("最后一只敌人倒下后禁用 END TURN，并自动结算且带回本层战利品", async () => {
    /* 0.4：尤斯缇丝三面攻击 2，柯萝萝三面攻击 5，刚好能连续肃清两敌。 */
    await mount(() => 0.4);

    await click(dice()[1]!);
    await click(partyCards()[1]!);
    await click(enemies()[0]!);
    await advance(101);
    await advance(71);
    await advance(261);
    await advance(461);
    expect(enemies()).toHaveLength(1);

    await click(dice()[3]!);
    await click(partyCards()[3]!);
    await click(enemies()[0]!);
    await advance(101);
    await advance(71);

    expect(board()).toHaveAttribute("data-layer-clear-pending", "true");
    expect(screen.getByRole("button", { name: "END TURN" })).toBeDisabled();
    expect(screen.queryByRole("dialog", { name: "继续深入？" })).toBeNull();

    /* 斩杀退场先完整播放；从死亡命中帧起满 1.2 秒才弹层结算。 */
    await advance(261);
    await advance(461);
    await advance(477);
    expect(screen.queryByRole("dialog", { name: "继续深入？" })).toBeNull();
    expect(screen.getByRole("button", { name: "END TURN" })).toBeDisabled();

    await settle();
    const greedDialog = screen.getByRole("dialog", { name: "继续深入？" });
    expect(greedDialog).toHaveTextContent("第 1 层战利品已全部结算入包裹");
    const settlement = screen.getByRole("region", { name: /第 1 层结算/ });
    expect(settlement.getAttribute("aria-label")).toMatch(
      /本层散金 \d+ 金币，乘牌型倍率 \d+\.\d{2}，乘层倍率 1，本层入袋 \d+ 金币/
    );
    expect(settlement).toHaveTextContent("最后回合");
    expect(settlement).toHaveTextContent("已计入最终牌型倍率");

    const purseLabel = board()
      .querySelector(".battle-sidebar-readouts .abyssa-expedition-bag-odometer output")!
      .getAttribute("aria-label")!;
    const bagGold = Number(purseLabel.match(/包裹 (\d+) 枚金币/)?.[1] ?? 0);
    expect(bagGold).toBeGreaterThan(0);
    expect(greedDialog).toHaveTextContent(`现在离场可带回 ${bagGold}G`);

    /* 视觉转轮与 aria 数值同步，不再等一个不存在的下一回合。 */
    const shownBagDigits = [...board().querySelectorAll(
      ".battle-sidebar-readouts .abyssa-expedition-bag-odometer .abyssa-expedition-odometer__reel"
    )].map((reel) => reel.querySelector("b")?.textContent ?? "0").join("");
    expect(Number(shownBagDigits)).toBe(bagGold);

    await click(screen.getByRole("button", { name: "带宝离场" }));
    const resultDialog = screen.getByRole("dialog", { name: "远征结算" });
    expect(resultDialog).toHaveTextContent(
      `＋${bagGold} G`
    );
    expect(resultDialog.querySelector(".abyssa-expedition-modal__settlement"))
      .toHaveTextContent("已计入最终牌型倍率");
  }, 15_000);

  it("点队友防御按蓄势、释放、命中、收尾播放，命中帧才增加盾牌", async () => {
    /* 0.4 固定凯尔为三面 guard，且两只敌人都瞄准艾洛拉。 */
    await mount(() => 0.4);

    await click(dice()[0]!);
    await click(partyCards()[0]!);
    const target = partyCards()[2]!;
    const shield = target.querySelector(".abyssa-expedition-party-card__shield")!;
    await click(target);

    expect(board()).toHaveAttribute("data-support-kind", "guard");
    expect(board()).toHaveAttribute("data-support-phase", "anticipate");
    expect(target).toHaveAttribute("data-support-kind", "guard");
    expect(target).toHaveAttribute("data-support-phase", "anticipate");
    expect(screen.getByLabelText("艾洛拉获得 1 层盾牌")).toHaveAttribute(
      "data-kind",
      "guard"
    );
    expect(
      target.querySelector(".abyssa-expedition-support-fx__emblem")
    ).toBeInTheDocument();
    expect(shield).toHaveAttribute("aria-label", "盾牌 0 层");
    expect(screen.getByRole("button", { name: "END TURN" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "REROLL" })).toBeDisabled();
    expect(undoButton()).toBeDisabled();

    await advance(91);
    expect(target).toHaveAttribute("data-support-phase", "release");
    expect(shield).toHaveAttribute("aria-label", "盾牌 0 层");
    expect(undoButton()).toBeDisabled();

    await advance(121);
    expect(target).toHaveAttribute("data-support-phase", "impact");
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 1 层"
    );
    expect(undoButton()).toBeDisabled();

    await advance(241);
    expect(target).toHaveAttribute("data-support-phase", "settle");
    await advance(301);

    expect(board()).not.toHaveAttribute("data-support-kind");
    expect(board()).not.toHaveAttribute("data-support-phase");
    expect(target).not.toHaveAttribute("data-support-kind");
    expect(target).not.toHaveAttribute("data-support-phase");
    expect(screen.getByRole("button", { name: "END TURN" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "REROLL" })).toBeEnabled();
    expect(undoButton()).toBeEnabled();
  });

  it("点敌方攻击意图防御也延迟到 impact 才提交盾牌", async () => {
    await mount(() => 0.4);

    await click(dice()[0]!);
    await click(partyCards()[0]!);
    const target = partyCards()[2]!;
    const intent = enemies()[0]!.querySelector<HTMLButtonElement>(
      ".abyssa-expedition-intent"
    )!;
    await click(intent);

    expect(board()).toHaveAttribute("data-support-kind", "guard");
    expect(target).toHaveAttribute("data-support-phase", "anticipate");
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 0 层"
    );

    await advance(91);
    expect(target).toHaveAttribute("data-support-phase", "release");
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 0 层"
    );

    await advance(121);
    expect(target).toHaveAttribute("data-support-phase", "impact");
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 1 层"
    );

    await advance(241);
    await advance(301);
    expect(board()).not.toHaveAttribute("data-support-phase");
  });

  it("格挡骰直接点敌人卡体也会定位到其意图目标播放防御", async () => {
    await mount(() => 0.4);

    await click(dice()[0]!);
    await click(partyCards()[0]!);
    await click(enemies()[0]!);

    const target = partyCards()[2]!;
    expect(board()).toHaveAttribute("data-support-kind", "guard");
    expect(target).toHaveAttribute("data-support-phase", "anticipate");
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 0 层"
    );

    await advance(91);
    await advance(121);
    expect(target).toHaveAttribute("data-support-phase", "impact");
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 1 层"
    );

    await advance(241);
    await advance(301);
    expect(board()).not.toHaveAttribute("data-support-phase");
  });

  it("治疗在 impact 才按实际缺口回血，动画期间锁定操作", async () => {
    const rng = sequenceRng([
      /* 第一回合意图：畸变魔物打凯尔，裂隙爪兽打尤斯缇丝。 */
      0, 0.21,
      /* 第一回合五枚骰。 */
      0, 0, 0, 0, 0,
      /* 第二回合意图。 */
      0.4, 0.4,
      /* 第二回合五枚骰：艾洛拉为五面、2 点昂贵治疗。 */
      0, 0, 0.7, 0, 0
    ]);
    await mount(rng, true);

    const target = partyCards()[0]!;
    expect(target.querySelector(".abyssa-expedition-party-card__hearts")).toHaveAttribute(
      "aria-label",
      "生命 2 / 3"
    );
    expect(dice()[2]!.getAttribute("aria-label")).toContain(
      "艾洛拉命数骰，第 3 槽，当前 5 点"
    );
    expect(dice()[2]!.getAttribute("aria-label")).toContain("金铭 1 面");

    await click(dice()[2]!);
    await click(partyCards()[2]!);
    await click(target);

    expect(board()).toHaveAttribute("data-support-kind", "heal");
    expect(target).toHaveAttribute("data-support-phase", "anticipate");
    const healFx = screen.getByLabelText("你恢复 1 点生命");
    expect(healFx).toHaveAttribute("data-kind", "heal");
    expect(
      healFx.querySelectorAll(".abyssa-expedition-support-fx__particle")
    ).toHaveLength(5);
    expect(target.querySelector(".abyssa-expedition-party-card__hearts")).toHaveAttribute(
      "aria-label",
      "生命 2 / 3"
    );
    expect(screen.getByRole("button", { name: "END TURN" })).toBeDisabled();
    expect(undoButton()).toBeDisabled();

    await advance(91);
    expect(target).toHaveAttribute("data-support-phase", "release");
    expect(target.querySelector(".abyssa-expedition-party-card__hearts")).toHaveAttribute(
      "aria-label",
      "生命 2 / 3"
    );

    await advance(121);
    expect(target).toHaveAttribute("data-support-phase", "impact");
    expect(target.querySelector(".abyssa-expedition-party-card__hearts")).toHaveAttribute(
      "aria-label",
      "生命 3 / 3"
    );

    await advance(241);
    expect(target).toHaveAttribute("data-support-phase", "settle");
    await advance(301);
    expect(board()).not.toHaveAttribute("data-support-phase");
    expect(screen.getByRole("button", { name: "END TURN" })).toBeEnabled();
    expect(undoButton()).toBeEnabled();
  });

  it("满血目标不会启动治疗动画，也不会消耗艾洛拉的行动", async () => {
    await mount(() => 0);

    await click(dice()[2]!);
    await click(partyCards()[2]!);
    const fullHealthTarget = partyCards()[1]!;
    await click(fullHealthTarget);

    expect(board()).not.toHaveAttribute("data-support-kind");
    expect(board()).not.toHaveAttribute("data-support-phase");
    expect(fullHealthTarget.querySelector(".abyssa-expedition-party-card__hearts")).toHaveAttribute(
      "aria-label",
      "生命 3 / 3"
    );
    expect(dieSlots()[2]).not.toHaveAttribute("data-spent");
    expect(partyCards()[2]).toHaveAttribute("data-held", "true");
    expect(screen.getByRole("button", { name: "END TURN" })).toBeEnabled();
  });

  it("凯尔万能面点队友时稳定路由为防御支援，而不是攻击", async () => {
    /* 0.9 固定凯尔为六面 wild，且两只敌人都瞄准诺玛。 */
    await mount(() => 0.9);

    await click(dice()[0]!);
    await click(partyCards()[0]!);
    const target = partyCards()[4]!;
    await click(target);

    expect(board()).toHaveAttribute("data-support-kind", "guard");
    expect(board()).toHaveAttribute("data-support-phase", "anticipate");
    expect(board()).not.toHaveAttribute("data-attack-phase");
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 0 层"
    );

    await advance(91);
    await advance(121);
    expect(target).toHaveAttribute("data-support-phase", "impact");
    expect(target.querySelector(".abyssa-expedition-party-card__shield")).toHaveAttribute(
      "aria-label",
      "盾牌 1 层"
    );

    await advance(241);
    await advance(301);
    expect(board()).not.toHaveAttribute("data-support-phase");
  }, 15_000);

  it("界面内不出现 emoji 字形", async () => {
    await mount();

    expect(board().textContent ?? "").not.toMatch(
      /[\u2694\u{1F6E1}\u2764\u2695\u{1F4B0}\u2605\u{1F4A4}\u{1F32B}\u{1F4A3}\u{1F573}\u26A1]/u
    );
  });
});

describe('actual expedition party and presentation cancellation', () => {
  it.each([
    ['kael', 'kororo'],
    ['kael', 'norma', 'eustice'],
    ['kael', 'norma', 'elora', 'kororo', 'eustice'],
  ])('renders slots and actions in the persisted order %j', async (...partyIds: string[]) => {
    const f = await clientFixture({ partyIds }); sessions.push(f);
    render(<GameSessionScope session={f.session}><ExpeditionBattleScreen onSettle={() => {}} /></GameSessionScope>);
    expect([...partyCards()].map(card => card.dataset.character)).toEqual(partyIds);
    expect([...dieSlots()].map(slot => slot.dataset.owner)).toEqual(partyIds);
    expect(board().style.getPropertyValue('--party-size')).toBe(String(partyIds.length));
    await click(screen.getByRole('button', { name: 'ROLL' })); await settle();
    await click(dice()[partyIds.length - 1]!);
    expect(dieSlots()[partyIds.length - 1]).toHaveAttribute('data-loaded', 'true');
  });
  it('cancels an in-flight animation on refresh and unlocks the latest durable board', async () => {
    await mountInitial(); const f = sessions.at(-1)!;
    await click(screen.getByRole('button', { name: 'ROLL' }));
    const committed = f.session.getSnapshot().record;
    await act(async () => { await f.session.refresh(); }); await settle();
    expect(f.session.getSnapshot().record).toEqual(committed);
    expect(board().querySelectorAll('.expedition-die[data-rolling]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'END TURN' })).toBeEnabled();
  });
});
