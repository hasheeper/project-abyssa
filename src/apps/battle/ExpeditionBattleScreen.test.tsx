import { readFileSync } from "node:fs";
import { StrictMode } from "react";
import { REROLLS_PER_ROUND } from "./engine";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpeditionBattleScreen } from "./ExpeditionBattleScreen";

beforeEach(() => {
  /*
   * 只假造定时器，不接管 rAF：光束动画是自我重排的 rAF 循环，
   * 若被 fake timers 接管，runAllTimers 会永远追不完。
   */
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 回合开始自动掷骰，推进滚动动画 */
function settle() {
  act(() => {
    vi.runAllTimers();
  });
}

/** 逐步 enemy runner 会在每个 await 后排下一枚定时器，需连微任务一起冲完。 */
async function settleAsync() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  /* runner 最后切到 roll 后，React effect 才会排骰子收尾计时器。 */
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

function mount(rng?: () => number) {
  const view = render(<ExpeditionBattleScreen rng={rng} />);
  settle();
  return view;
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

describe("开局不得卡死", () => {
  it("StrictMode 下掷骰动画会正常收尾，盘面可交互", () => {
    render(
      <StrictMode>
        <ExpeditionBattleScreen />
      </StrictMode>
    );
    settle();

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
  it("cycles the original timber, hero, four-regent and demon-lord frame skins", () => {
    mount();

    const switcher = screen.getByRole("button", { name: /切换战斗界面风格/ });
    expect(board()).toHaveAttribute("data-ui-skin", "timber");
    expect(board()).not.toHaveAttribute("data-ui-ornamented");
    expect(board().querySelectorAll(".abyssa-expedition-frame__top-ornament")).toHaveLength(0);
    expect(board().querySelectorAll(".abyssa-expedition-frame__corner-ornaments")).toHaveLength(0);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave")).toHaveLength(0);
    expect(switcher).toHaveTextContent("原生木框");

    fireEvent.click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "hero-party");
    expect(board()).toHaveAttribute("data-ui-ornamented");
    expect(board().querySelectorAll(".abyssa-expedition-frame__top-ornament")).toHaveLength(2);
    expect(board().querySelectorAll(".abyssa-expedition-frame__corner-ornaments img")).toHaveLength(4);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave")).toHaveLength(1);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave [data-frame-edge]")).toHaveLength(4);
    expect(switcher).toHaveTextContent("勇者小队");

    fireEvent.click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "demon-cadre");
    expect(board()).toHaveAttribute("data-ui-ornamented");
    expect(board().querySelectorAll(".abyssa-expedition-frame__top-ornament")).toHaveLength(2);
    expect(board().querySelectorAll(".abyssa-expedition-frame__corner-ornaments img")).toHaveLength(4);
    expect(board().querySelectorAll(".abyssa-expedition-frame__edge-weave")).toHaveLength(1);
    expect(switcher).toHaveTextContent("四席摄政");

    fireEvent.click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "demon-lord");
    expect(switcher).toHaveTextContent("魔王亲征");

    fireEvent.click(switcher);
    expect(board()).toHaveAttribute("data-ui-skin", "timber");
  });

  it("开局自动掷骰，没有 ROLL 按钮", () => {
    mount();

    expect(screen.queryByRole("button", { name: "ROLL" })).toBeNull();
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
    /* 全部已掷出 */
    expect(board().querySelectorAll(".abyssa-expedition-die-slot[data-unrolled]")).toHaveLength(0);
  });

  it("底栏是 UNDO / REROLL / 重掷读数 / END TURN", () => {
    mount();

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

  it("骰子是多选装载，可同时装载多枚", () => {
    mount();
    const list = dice();

    fireEvent.click(list[0]!);
    fireEvent.click(list[2]!);
    fireEvent.click(list[4]!);

    const slots = dieSlots();
    expect(slots[0]!.dataset.loaded).toBe("true");
    expect(slots[1]!.dataset.loaded).toBeUndefined();
    expect(slots[2]!.dataset.loaded).toBe("true");
    expect(slots[3]!.dataset.loaded).toBeUndefined();
    expect(slots[4]!.dataset.loaded).toBe("true");
  });

  it("再次点击骰子即卸载", () => {
    mount();
    const list = dice();

    fireEvent.click(list[1]!);
    expect(dieSlots()[1]!.dataset.loaded).toBe("true");

    fireEvent.click(list[1]!);
    expect(dieSlots()[1]!.dataset.loaded).toBeUndefined();
  });

  it("未装载时角色卡不可指挥；装载后才待命", () => {
    mount();

    expect(partyCards()[0]!.dataset.ready).toBeUndefined();

    fireEvent.click(dice()[0]!);
    expect(partyCards()[0]!.dataset.ready).toBe("true");
  });

  it("点角色卡拿起，再点一次放下", () => {
    /* 固定凯尔为攻击面，避免随机到可对自己施放的格挡面。 */
    mount(() => 0);

    fireEvent.click(dice()[0]!);
    fireEvent.click(partyCards()[0]!);
    expect(partyCards()[0]!.dataset.held).toBe("true");
    expect(board().querySelectorAll(".abyssa-expedition-party-column[data-active]")).toHaveLength(1);

    fireEvent.click(partyCards()[0]!);
    expect(partyCards()[0]!.dataset.held).toBeUndefined();
  });

  it("装载即点亮曲线光束，拿起后再加强", () => {
    mount();

    /* 未装载：光束不亮 */
    expect(board().querySelectorAll(".abyssa-expedition-party-column[data-active]")).toHaveLength(0);

    /* 装载骰子 → 光束通电 */
    fireEvent.click(dice()[0]!);
    expect(board().querySelectorAll(".abyssa-expedition-party-column[data-active]")).toHaveLength(1);
    /* 光束 SVG 存在 */
    expect(
      board().querySelector(".abyssa-expedition-party-column[data-active] .abyssa-expedition-party-link__main")
    ).not.toBeNull();

    /* 拿起角色卡 → 加强档 */
    fireEvent.click(partyCards()[0]!);
    expect(board().querySelectorAll(".abyssa-expedition-party-column[data-held]")).toHaveLength(1);
  });

  it("重掷次数耗尽后未装载骰自动装载，REROLL 禁用", () => {
    mount();

    /* 用尽全部重掷次数 */
    for (let i = 0; i < REROLLS_PER_ROUND; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "REROLL" }));
      settle();
    }

    expect(screen.getByLabelText("重掷剩余 0 次")).toHaveTextContent("×0");
    expect(screen.getByRole("button", { name: "REROLL" })).toBeDisabled();

    /* 全部自动装载 */
    for (const slot of dieSlots()) {
      expect(slot.dataset.loaded ?? slot.dataset.sealed).toBeTruthy();
    }
  });

  it("重掷清空撤销栈：UNDO 变灰", () => {
    mount();

    fireEvent.click(dice()[0]!);
    expect(undoButton()).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "REROLL" }));
    settle();

    expect(undoButton()).toBeDisabled();
  });

  it("UNDO 可撤销装载", () => {
    mount();

    fireEvent.click(dice()[0]!);
    expect(dieSlots()[0]!.dataset.loaded).toBe("true");

    fireEvent.click(undoButton());
    expect(dieSlots()[0]!.dataset.loaded).toBeUndefined();
  });

  it("END TURN 让敌方行动并在命中帧写入日志", async () => {
    mount();

    const before = board().querySelectorAll(".abyssa-expedition-battle-log li").length;
    fireEvent.click(screen.getByRole("button", { name: "END TURN" }));

    expect(board()).toHaveAttribute("data-enemy-turn-phase", "anticipate");
    await advance(121);
    await advance(101);
    await advance(61);

    expect(
      board().querySelectorAll(".abyssa-expedition-battle-log li").length
    ).toBeGreaterThan(before);
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
    mount(rng);

    fireEvent.click(screen.getByRole("button", { name: "END TURN" }));

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
    expect(
      dieSlots()[1]!.querySelector('.expedition-die__face[data-face="1"]')
    ).toHaveAttribute("data-quality", "rust");
    expect(dice()[1]).toBeDisabled();
  });

  it("完全格挡播放卡内盾击，不扣红心也不标记心损失", async () => {
    /* 凯尔三面 guard 1；两只敌人都瞄准艾洛拉。 */
    mount(() => 0.4);

    fireEvent.click(dice()[0]!);
    fireEvent.click(partyCards()[0]!);
    fireEvent.click(
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

    fireEvent.click(screen.getByRole("button", { name: "END TURN" }));
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

  it("狂暴预警按 2、1、即将爆发递减，强化攻击只在新回合公开", async () => {
    mount(() => 0);

    /* 柯萝萝一面 4 伤斩掉第二只，使剩余 2 血兽进入残局判定。 */
    fireEvent.click(dice()[3]!);
    fireEvent.click(partyCards()[3]!);
    fireEvent.click(enemies()[1]!);
    await advance(101);
    await advance(71);
    await advance(261);
    await advance(461);

    fireEvent.click(screen.getByRole("button", { name: "END TURN" }));
    let warning = board().querySelector(".abyssa-expedition-enemy__frenzy-status")!;
    expect(warning).toHaveTextContent("狂暴预警");
    expect(warning).toHaveTextContent("2 回合");
    expect(warning).toHaveTextContent("ATK 1 → 4");
    expect(enemies()[0]!.querySelector(".abyssa-expedition-intent b")).toHaveTextContent("1");
    expect(enemies()[0]).not.toHaveAttribute("data-frenzied");

    await settleAsync();
    fireEvent.click(screen.getByRole("button", { name: "END TURN" }));
    warning = board().querySelector(".abyssa-expedition-enemy__frenzy-status")!;
    expect(warning).toHaveTextContent("1 回合");
    expect(enemies()[0]!.querySelector(".abyssa-expedition-intent b")).toHaveTextContent("1");

    await settleAsync();
    fireEvent.click(screen.getByRole("button", { name: "END TURN" }));
    warning = board().querySelector(".abyssa-expedition-enemy__frenzy-status")!;
    expect(warning).toHaveTextContent("即将爆发");
    expect(enemies()[0]).not.toHaveAttribute("data-frenzied");

    await settleAsync();
    expect(enemies()[0]).toHaveAttribute("data-frenzied", "true");
    expect(enemies()[0]).toHaveAttribute("data-frenzy-active", "true");
    const activeFrenzy = board().querySelector(
      '.abyssa-expedition-enemy__frenzy-status[data-active="true"]'
    );
    expect(activeFrenzy).toHaveTextContent("狂暴中");
    expect(activeFrenzy).toHaveTextContent("持续至死亡");
    expect(activeFrenzy).toHaveTextContent("ATK 4 · 不可解除");
    expect(enemies()[0]!.querySelector(".abyssa-expedition-intent b")).toHaveTextContent("4");
  });

  it("五张队员卡与敌方意图均已渲染", () => {
    mount();

    for (const name of ["凯尔", "尤斯缇丝", "艾洛拉", "柯萝萝", "诺玛"]) {
      expect(screen.getByRole("article", { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("region", { name: "敌方单位" }).querySelectorAll(".abyssa-expedition-intent").length
    ).toBeGreaterThan(0);
  });

  it("红心只渲染上限数量，左侧徽标是盾牌层数", () => {
    mount();

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

  it("骰面 rail 只用菱形，高伤害面升格为大菱形而非数字", () => {
    mount();

    /* rail 内不得出现数字读数 */
    expect(board().querySelector(".expedition-die__rail-value")).toBeNull();

    /* 柯萝萝有 power 4/5 面，其骰上必存在大菱形槽 */
    const grand = board().querySelectorAll(".expedition-die__rail[data-grand]");
    expect(grand.length).toBeGreaterThan(0);
    /* 大菱形槽内只有一颗宝石 */
    for (const rail of grand) {
      expect(rail.querySelectorAll(".expedition-die__stud")).toHaveLength(1);
      expect(rail.querySelector(".expedition-die__stud[data-grand]")).not.toBeNull();
    }
  });

  it("摆烂面复用短凹槽显示小红叉，且不能指挥角色", () => {
    mount(() => 0.9);

    const blankFaces = board().querySelectorAll('.expedition-die__face[data-verb="blank"]');
    expect(blankFaces.length).toBeGreaterThan(0);
    for (const face of blankFaces) {
      const rail = face.querySelector('.expedition-die__rail[data-blank="true"]');
      expect(rail).not.toBeNull();
      expect(rail!.querySelectorAll(".expedition-die__stud")).toHaveLength(0);
      expect(rail!.querySelector(".expedition-die__unusable-mark")).not.toBeNull();
    }

    const css = readFileSync("src/apps/battle/expedition.css", "utf8");
    const blankRailRule = css.match(
      /\.expedition-die__rail\[data-blank\]\s*\{([^}]*)\}/
    )?.[1];
    expect(blankRailRule).toContain("height:");
    /* 材质、内阴影和圆角必须继承通用 rail，blank 只负责缩短。 */
    expect(blankRailRule).not.toContain("background:");
    expect(blankRailRule).not.toContain("box-shadow:");
    expect(blankRailRule).not.toContain("border-radius:");

    /* 0.9 令柯萝萝掷出六面 blank：可锁定点数，但角色卡不亮、不响应。 */
    expect(dice()[3]).toHaveAttribute("data-unusable", "true");
    expect(dice()[3]!.getAttribute("aria-label")).toContain("无行动面，无法指挥角色");
    fireEvent.click(dice()[3]!);
    expect(dieSlots()[3]).toHaveAttribute("data-loaded", "true");
    expect(partyCards()[3]).not.toHaveAttribute("data-ready");
    fireEvent.click(partyCards()[3]!);
    expect(partyCards()[3]).not.toHaveAttribute("data-held");
  });

  it("意图线按威胁分级着色，且随 undo 变化", () => {
    mount();

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

  it("底栏有牌型读数槽，成牌时点亮并显示倍率", () => {
    mount();

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
      expect(slot.getAttribute("aria-label")).toMatch(/倍率 \+/);
    } else {
      expect(slot.getAttribute("data-idle")).toBe("true");
      expect(slot.querySelector(".abyssa-expedition-hand__bonus")).toHaveTextContent("—");
    }
  });

  it("成牌时点亮参与骰的命数角标", () => {
    /* 固定同点数，确保稳定形成牌型而不是依赖 Math.random。 */
    mount(() => 0.4);

    const slot = board().querySelector(".abyssa-expedition-hand")!;
    const lit = board().querySelectorAll(".expedition-die__face[data-scoring]");

    if (slot.getAttribute("data-scoring") === "true") {
      /* 成牌：至少两枚骰的结果面角标亮起 */
      expect(lit.length).toBeGreaterThanOrEqual(2);
    } else {
      /* 未成牌：不得有任何角标亮起 */
      expect(lit).toHaveLength(0);
    }
  });

  it("我方选中态压过敌方瞄准态", () => {
    /* 固定被瞄准者为艾洛拉，且其骰面可行动，避免随机到 blank。 */
    mount(() => 0.4);

    /* 找一张正被瞄准的卡 */
    const targeted = board().querySelector<HTMLElement>(
      ".abyssa-expedition-party-card[data-targeted]"
    );
    if (!targeted) return;

    const memberId = targeted.dataset.character!;
    const index = [...partyCards()].indexOf(targeted);
    expect(index).toBeGreaterThanOrEqual(0);

    /* 装载该角色的骰子并拿起 */
    fireEvent.click(dice()[index]!);
    fireEvent.click(targeted);

    const after = board().querySelector<HTMLElement>(
      `.abyssa-expedition-party-card[data-character="${memberId}"]`
    )!;
    /* 两个状态同时存在，但 held 必须仍然生效（书写顺序在后） */
    expect(after.dataset.held).toBe("true");

    /* 威胁态仍在，但不该压过选中态 */
    expect(after.dataset.targeted).toBe("true");
  });

  it("选中态的 CSS 规则必须写在威胁态之后（同特异度下后者胜出）", () => {
    const css = readFileSync("src/apps/battle/expedition.css", "utf8");
    const targeted = css.indexOf(".abyssa-expedition-party-card[data-targeted] {");
    const held = css.indexOf(".abyssa-expedition-party-card[data-held],");

    expect(targeted).toBeGreaterThan(-1);
    expect(held).toBeGreaterThan(-1);
    /* 我方选中态在后，才能覆盖敌方威胁态 */
    expect(held).toBeGreaterThan(targeted);
  });

  it("侧栏展示牌型 × 层基础倍率的拆解，且包裹与本层分开", () => {
    mount();

    const breakdown = board().querySelector(".abyssa-expedition-multiplier__breakdown")!;
    expect(breakdown).not.toBeNull();
    /* 必须点明是第几层、层倍率多少 */
    expect(breakdown.textContent).toMatch(/牌型 ×/);
    expect(breakdown.textContent).toMatch(/第 1 层 ×1/);

    /* 包裹读数与本层散金是两个不同的量 */
    const purse = board().querySelector(".abyssa-expedition-purse")!;
    expect(purse.getAttribute("aria-label")).toMatch(/包裹 \d+ 金币，本层散金 \d+ 金币/);
  });

  it("expedition.css 括号配平（防止批量改写破坏结构）", () => {
    const css = readFileSync("src/apps/battle/expedition.css", "utf8");
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

  it("默认骰子保持实色，并与角色卡共框；成牌角标使用硬边凹刻", () => {
    const css = readFileSync("src/apps/battle/expedition.css", "utf8");
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
    const scoringNumberRule = css.match(
      /\.expedition-die__face\[data-scoring\] \.expedition-die__corner > b\s*\{([^}]*)\}/
    )?.[1];
    const scoringSuitRule = css.match(
      /\.expedition-die__face\[data-scoring\] \.expedition-die__corner > i\s*\{([^}]*)\}/
    )?.[1];

    expect(defaultDieRule).toContain("opacity: 1");
    expect(battlefieldRule).toContain(
      "grid-template-rows: var(--expedition-enemy-panel-h) 497px"
    );
    expect(partyRule).toContain("grid-row: 2");
    expect(dicePanelRule).toContain("grid-row: 2");
    expect(scoringNumberRule).not.toMatch(/0\s+0\s+[1-9]\d*px/);
    expect(scoringNumberRule).not.toContain("animation:");
    expect(scoringSuitRule).not.toContain("drop-shadow(0 0");
    expect(scoringSuitRule).not.toContain("animation:");
  });

  it("攻击特效由敌方 formation 裁剪，不截断跨区意图线", () => {
    const css = readFileSync("src/apps/battle/expedition.css", "utf8");
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

  it("装载骰子后立即启动交缠光束动画", () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");
    mount();
    requestFrame.mockClear();

    fireEvent.click(dice()[0]!);
    expect(requestFrame).toHaveBeenCalled();
  });

  it("转轮行高只有 CSS 单一来源，JS 不写死像素", () => {
    const reels = readFileSync("src/apps/battle/ExpeditionReels.tsx", "utf8");
    /* 位移必须走 CSS 变量，否则改 CSS 尺寸会与 JS 脱节 */
    expect(reels).toContain("var(--odometer-digit-h)");
    expect(reels).not.toMatch(/translateY\(\$\{[^}]*\d+\}px\)/);
  });

  it("掷骰与重掷时，所有参与骰都进入滚动态", () => {
    render(<ExpeditionBattleScreen />);

    const board = screen.getByRole("main", { name: "裂隙远征战斗界面" });
    /* 开局自动掷骰：五枚全滚 */
    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(5);

    settle();
    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);

    /* 装载一枚后重掷：只有未装载的四枚滚动 */
    const dice = board.querySelectorAll<HTMLButtonElement>(".expedition-die");
    fireEvent.click(dice[0]!);
    fireEvent.click(screen.getByRole("button", { name: "REROLL" }));

    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(4);
    settle();
    expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
  });

  it("普通攻击按蓄势、顿帧、命中、收势播放，命中帧才扣血", async () => {
    mount(() => 0);

    /* 凯尔一面是 1 点攻击；第一只怪物有 2 点生命，不会斩杀。 */
    fireEvent.click(dice()[0]!);
    fireEvent.click(partyCards()[0]!);
    const target = enemies()[0]!;
    const health = target.querySelector(".abyssa-expedition-enemy__health")!;
    fireEvent.click(target);

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
    mount(() => 0);

    /* 柯萝萝一面是 4 点攻击，足以斩杀第一只 2 血怪物。 */
    fireEvent.click(dice()[3]!);
    fireEvent.click(partyCards()[3]!);
    const target = enemies()[0]!;
    fireEvent.click(target);

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

    fireEvent.click(undoButton());
    expect(enemies()).toHaveLength(2);
    expect(enemies()[0]).not.toHaveAttribute("data-defeated");
    expect(enemies()[0]!.style.animationDelay).toBe("0ms");
  });

  it("最后一只敌人倒下后禁用 END TURN，并自动结算且带回本层战利品", async () => {
    /* 0.4：尤斯缇丝三面攻击 2，柯萝萝三面攻击 5，刚好能连续肃清两敌。 */
    mount(() => 0.4);

    fireEvent.click(dice()[1]!);
    fireEvent.click(partyCards()[1]!);
    fireEvent.click(enemies()[0]!);
    await advance(101);
    await advance(71);
    await advance(261);
    await advance(461);
    expect(enemies()).toHaveLength(1);

    fireEvent.click(dice()[3]!);
    fireEvent.click(partyCards()[3]!);
    fireEvent.click(enemies()[0]!);
    await advance(101);
    await advance(71);

    expect(board()).toHaveAttribute("data-layer-clear-pending", "true");
    expect(screen.getByRole("button", { name: "END TURN" })).toBeDisabled();
    expect(screen.queryByRole("dialog", { name: "继续深入？" })).toBeNull();
    const finalizingMultiplier = board().querySelector(
      ".abyssa-expedition-multiplier"
    )!;
    expect(finalizingMultiplier).toHaveAttribute("data-finalizing", "true");
    expect(finalizingMultiplier).toHaveTextContent("本回合已计入");
    expect(finalizingMultiplier.getAttribute("aria-label")).toContain(
      "已计入最后回合"
    );

    /* 斩杀退场先完整播放；从死亡命中帧起满 1.2 秒才弹层结算。 */
    await advance(261);
    await advance(461);
    await advance(477);
    expect(screen.queryByRole("dialog", { name: "继续深入？" })).toBeNull();
    expect(screen.getByRole("button", { name: "END TURN" })).toBeDisabled();

    await advance(2);
    const greedDialog = screen.getByRole("dialog", { name: "继续深入？" });
    expect(greedDialog).toHaveTextContent("第 1 层战利品已全部结算入包裹");
    const settlement = screen.getByRole("region", { name: /第 1 层结算/ });
    expect(settlement.getAttribute("aria-label")).toMatch(
      /本层散金 \d+ 金币，乘牌型倍率 \d+\.\d{2}，乘层倍率 1，本层入袋 \d+ 金币/
    );
    expect(settlement).toHaveTextContent("最后回合");
    expect(settlement).toHaveTextContent("已计入最终牌型倍率");

    const purseLabel = board()
      .querySelector(".abyssa-expedition-purse")!
      .getAttribute("aria-label")!;
    const bagGold = Number(purseLabel.match(/包裹 (\d+) 金币/)?.[1] ?? 0);
    expect(bagGold).toBeGreaterThan(0);
    expect(greedDialog).toHaveTextContent(`现在离场可带回 ${bagGold}G`);

    /* 视觉转轮与 aria 数值同步，不再等一个不存在的下一回合。 */
    const shownBagDigits = [...board().querySelectorAll(
      ".abyssa-expedition-purse .abyssa-expedition-bag-odometer .abyssa-expedition-odometer__reel"
    )].map((reel) => reel.querySelector("b")?.textContent ?? "0").join("");
    expect(Number(shownBagDigits)).toBe(bagGold);

    fireEvent.click(screen.getByRole("button", { name: "带宝离场" }));
    const resultDialog = screen.getByRole("dialog", { name: "远征结算" });
    expect(resultDialog).toHaveTextContent(
      `＋${bagGold} G`
    );
    expect(resultDialog.querySelector(".abyssa-expedition-modal__settlement"))
      .toHaveTextContent("已计入最终牌型倍率");
  }, 15_000);

  it("点队友防御按蓄势、释放、命中、收尾播放，命中帧才增加盾牌", async () => {
    /* 0.4 固定凯尔为三面 guard，且两只敌人都瞄准艾洛拉。 */
    mount(() => 0.4);

    fireEvent.click(dice()[0]!);
    fireEvent.click(partyCards()[0]!);
    const target = partyCards()[2]!;
    const shield = target.querySelector(".abyssa-expedition-party-card__shield")!;
    fireEvent.click(target);

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
    mount(() => 0.4);

    fireEvent.click(dice()[0]!);
    fireEvent.click(partyCards()[0]!);
    const target = partyCards()[2]!;
    const intent = enemies()[0]!.querySelector<HTMLButtonElement>(
      ".abyssa-expedition-intent"
    )!;
    fireEvent.click(intent);

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
    mount(() => 0.4);

    fireEvent.click(dice()[0]!);
    fireEvent.click(partyCards()[0]!);
    fireEvent.click(enemies()[0]!);

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
    mount(rng);

    fireEvent.click(screen.getByRole("button", { name: "END TURN" }));
    await settleAsync();

    const target = partyCards()[0]!;
    expect(target.querySelector(".abyssa-expedition-party-card__hearts")).toHaveAttribute(
      "aria-label",
      "生命 2 / 3"
    );
    expect(dice()[2]!.getAttribute("aria-label")).toContain(
      "艾洛拉命数骰，第 3 槽，当前 5 点"
    );
    expect(dice()[2]!.getAttribute("aria-label")).toContain("金铭 1 面");

    fireEvent.click(dice()[2]!);
    fireEvent.click(partyCards()[2]!);
    fireEvent.click(target);

    expect(board()).toHaveAttribute("data-support-kind", "heal");
    expect(target).toHaveAttribute("data-support-phase", "anticipate");
    const healFx = screen.getByLabelText("凯尔恢复 1 点生命");
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

  it("满血目标不会启动治疗动画，也不会消耗艾洛拉的行动", () => {
    mount(() => 0);

    fireEvent.click(dice()[2]!);
    fireEvent.click(partyCards()[2]!);
    const fullHealthTarget = partyCards()[1]!;
    fireEvent.click(fullHealthTarget);

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
    mount(() => 0.9);

    fireEvent.click(dice()[0]!);
    fireEvent.click(partyCards()[0]!);
    const target = partyCards()[4]!;
    fireEvent.click(target);

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
  });

  it("界面内不出现 emoji 字形", () => {
    mount();

    expect(board().textContent ?? "").not.toMatch(
      /[\u2694\u{1F6E1}\u2764\u2695\u{1F4B0}\u2605\u{1F4A4}\u{1F32B}\u{1F4A3}\u{1F573}\u26A1]/u
    );
  });
});
