import { CampaignMenuScope } from "../../game-client/CampaignMenuScope";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../shared/loading/images", () => ({prepareImages: vi.fn(async () => {})}));
import { manorClientFixture } from "../../game-client/testing/manor";
import { GameSessionScope } from "../../game-client/react";
import { ManorBattleBinding } from "./ManorBattleBinding";
import { SceneTransitionProvider } from "../../shared/transition";
import { SCENE_SEQUENCE_MS } from "../../shared/presentation/adv/SceneSequence";
const fixtures: Awaited<ReturnType<typeof manorClientFixture>>[] = [];
afterEach(() => {
  cleanup();
  fixtures.splice(0).forEach((f) => f.session.dispose());
  vi.useRealTimers();
});
const click = async (node: Element) => {
  await act(async () => {
    fireEvent.click(node);
  });
};
const finish = async () => {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
};
const enter = async () => {
  await act(async () => {}); // Resolve decoded assets before advancing the board clock.
  await act(() => vi.advanceTimersByTimeAsync(0));
  await act(async () => {await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));});
  await act(() => vi.advanceTimersByTimeAsync(SCENE_SEQUENCE_MS.boardIn));
  for (const node of document.querySelectorAll<HTMLElement>("[data-scene-settle]"))
    fireEvent(node, Object.assign(new Event("animationend", {bubbles:true}), {animationName:node.dataset.sceneSettle}));
  expect(document.querySelector(".scene-sequence")).toHaveAttribute("data-phase", "idle");
};
/* 固定种子 19：roll 后艾洛拉持格挡面，三只候席客分别瞄准凯尔／尤斯缇丝／艾洛拉。 */
const mountManor = async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const f = await manorClientFixture();
  fixtures.push(f);
  const view = render(
    <GameSessionScope session={f.session}>
      <SceneTransitionProvider><ManorBattleBinding onSettle={() => {}} uiSkin="old-manor" /></SceneTransitionProvider>
    </GameSessionScope>,
  );
  await enter();
  const board = screen.getByRole("main", { name: "克雷格旧庄园战斗界面" });
  await click(screen.getByRole("button", { name: "ROLL" }));
  await finish();
  /* 固定骰子即选中艾洛拉，不再补点角色卡。 */
  await click(board.querySelector('[data-owner="elora"] .expedition-die')!);
  await finish();
  expect(board.querySelector('[data-character="elora"]')).toHaveAttribute("data-held", "true");
  return { f, view, board };
};

it("固定即选中，固定其他队员切换选中，再次点击只解除该枚固定", async () => {
  const {f, board} = await mountManor();
  const die = (id: string) => board.querySelector(`[data-owner="${id}"] .expedition-die`)!;
  const card = (id: string) => board.querySelector(`[data-character="${id}"]`)!;
  const read = () => f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  const hp = read().battle!.enemies.map(enemy => enemy.hp);

  await click(die("eustice")); await finish();
  expect(card("eustice")).toHaveAttribute("data-held", "true");
  expect(card("elora")).not.toHaveAttribute("data-held");
  expect(read().party.filter(m => ["elora", "eustice"].includes(m.id)).every(m => m.die?.loaded)).toBe(true);
  expect(read().battle!.enemies.map(enemy => enemy.hp)).toEqual(hp);
  expect(read().party.every(m => !m.die?.spent)).toBe(true);

  // Unfixing a different held die must not steal the selected actor.
  await click(die("elora")); await finish();
  expect(card("eustice")).toHaveAttribute("data-held", "true");
  expect(read().party.find(m => m.id === "elora")!.die?.loaded).toBe(false);
  await click(die("eustice")); await finish();
  expect(board.querySelectorAll(".abyssa-expedition-party-card[data-held]")).toHaveLength(0);
  expect(read().party.find(m => m.id === "eustice")!.die?.loaded).toBe(false);
});

it("拿盾骰点被攻击的队友即格挡其最大威胁，与裂隙版交互一致", async () => {
  const { board } = await mountManor();
  expect(board.querySelector(".battle-reaction")).toHaveAttribute("data-actor", "eustice");
  const target = board.querySelector('[data-character="eustice"]')!;
  const shield = target.querySelector(".abyssa-expedition-party-card__shield")!;
  expect(shield).toHaveAttribute("aria-label", expect.stringContaining("0"));

  await click(target);
  expect(board.querySelector(".battle-reaction")).toHaveAttribute("data-actor", "elora");
  expect(board.querySelector(".battle-reaction__name")).toHaveTextContent("掩护");
  expect(board).toHaveAttribute("data-support-kind", "guard");
  await finish();

  expect(board).not.toHaveAttribute("data-support-kind");
  expect(shield.textContent).not.toBe("0");
});

it("拿盾骰点敌人卡体也会格挡该敌人的攻击意图", async () => {
  const { f, board } = await mountManor();
  const view = f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  const attacker = view.battle!.enemies.find((e) => e.intent?.kind === "attack")!;
  const victim = board.querySelector(`[data-character="${attacker.intent!.targetId}"]`)!;
  const enemyCard = [...board.querySelectorAll(".abyssa-expedition-enemy")].find((node) =>
    node.textContent?.includes(attacker.definition.name!),
  )!;

  await click(enemyCard);
  expect(board).toHaveAttribute("data-support-kind", "guard");
  await finish();

  expect(
    victim.querySelector(".abyssa-expedition-party-card__shield")!.textContent,
  ).not.toBe("0");
});

it("uses the approved battle structure with manor content and animates only rolled owners", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const f = await manorClientFixture();
  fixtures.push(f);
  render(
    <GameSessionScope session={f.session}>
      <SceneTransitionProvider><ManorBattleBinding onSettle={() => {}} uiSkin="old-manor" /></SceneTransitionProvider>
    </GameSessionScope>,
  );
  await enter();
  const board = screen.getByRole("main", { name: "克雷格旧庄园战斗界面" });
  expect(
    board.querySelectorAll(".abyssa-expedition-party-card__skills"),
  ).toHaveLength(5);
  expect(
    board.querySelectorAll(".abyssa-expedition-party-nameplate"),
  ).toHaveLength(5);
  expect(board.querySelectorAll(".abyssa-expedition-undo")).toHaveLength(1);
  expect(screen.getAllByText("候席客")).toHaveLength(3);
  const member = f.runtime.queries.journey(f.session.getSnapshot().record!)!
    .party[1];
  expect(
    board.querySelector(
      `[data-character="${member.id}"] .abyssa-expedition-party-card__hearts`,
    ),
  ).toHaveAttribute("aria-label", `生命 ${member.hp} / ${member.config.maxHp}`);
  await click(screen.getByRole("button", { name: "ROLL" }));
  expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(
    5,
  );
  await finish();
  const held = board.querySelector(".expedition-die")!;
  await click(held);
  await finish();
  const transform = held
    .querySelector(".expedition-die__cube")!
    .getAttribute("style");
  await click(screen.getByRole("button", { name: "REROLL" }));
  expect(held).not.toHaveAttribute("data-rolling");
  expect(held.querySelector(".expedition-die__cube")).toHaveAttribute(
    "style",
    transform!,
  );
  expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(
    4,
  );
  await finish();
  await act(async () => {
    await f.session.refresh();
  });
  expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(
    0,
  );
});

it("道具从七槽直接提交；取消不扣除、每回合两次限制和刷新后的余量一致", async () => {
  vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
  const f=await manorClientFixture();fixtures.push(f);
  render(<GameSessionScope session={f.session}><SceneTransitionProvider><ManorBattleBinding onSettle={() => {}} uiSkin="old-manor"/></SceneTransitionProvider></GameSessionScope>);
  await enter();
  const read=() => f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  await click(screen.getByRole("button",{name:"打开道具坞"}));
  expect(screen.getByRole("list",{name:"携带道具"}).children).toHaveLength(7);
  const before=f.session.getSnapshot().record!.head.revision;
  await click(screen.getByRole("button",{name:"护符，剩余 2 次"}));
  expect(screen.queryByRole("dialog",{name:"护符"})).toBeNull();
  expect(screen.getByRole("button",{name:/第 \d 席 · 攻击你/})).toBeVisible();
  expect(screen.queryByRole("button",{name:/攻击凯尔/})).toBeNull();
  await click(screen.getByRole("button",{name:"返回道具"}));
  expect(f.session.getSnapshot().record!.head.revision).toBe(before);
  for (const charges of [2,1]) {
    await click(screen.getByRole("button",{name:`护符，剩余 ${charges} 次`}));
    const target=screen.getAllByRole("button",{name:/第 \d 席 · 攻击/})[0];
    await act(async () => {fireEvent.click(target);fireEvent.click(target);});
    await finish();
    expect(read().supplies.find(s=>s.definition.kind === "ward")!.charges).toBe(charges-1);
  }
  expect(read().battle!.encounter.itemsUsed).toBe(2);
  expect(read().supplies.every(s => s.targets.length === 0)).toBe(true);
  expect(screen.getByRole("button",{name:"护符，剩余 0 次"})).toHaveAttribute("aria-disabled","true");
  await act(async () => {await f.session.refresh();});
  expect(read().supplies.find(s=>s.definition.kind === "ward")!.charges).toBe(0);
}, 15_000); // Real multi-item transactions, duplicate-click checks and restore.

it("左侧菜单读取最新合法状态，结束回合走现有提交，导航仅携带恢复链接", async () => {
  vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
  const f=await manorClientFixture();fixtures.push(f);
  render(<GameSessionScope session={f.session}><SceneTransitionProvider><CampaignMenuScope><ManorBattleBinding onSettle={() => {}} uiSkin="old-manor"/></CampaignMenuScope></SceneTransitionProvider></GameSessionScope>);
  await enter();
  // Scope menu queries so each assertion does not walk all thirty die SVGs.
  const menu = within(screen.getByRole("complementary",{name:"游戏导航"}));
  expect(menu.getByRole("button",{name:/结束回合/})).toBeDisabled();
  await click(screen.getByRole("button",{name:"ROLL"}));await finish();
  const read=() => f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  const round=read().battle!.encounter.round;
  expect(menu.getByRole("button",{name:/撤退/})).toBeDisabled();
  await click(menu.getByRole("button",{name:/结束回合/}));await finish();
  expect(read().battle!.encounter.round).toBe(round+1);
  const before=f.session.getSnapshot().record!.head.revision;
  expect(menu.getByRole("link",{name:/继续远征/})).toHaveAttribute("href",expect.stringContaining("expedition=manor-run"));
  expect(f.session.getSnapshot().record!.head.revision).toBe(before);
});

it("enemy-turn completion permits a food target before the next roll", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const f = await manorClientFixture(19, 4, ["item.food", "item.potion"]); fixtures.push(f);
  render(<GameSessionScope session={f.session}><SceneTransitionProvider><ManorBattleBinding onSettle={() => {}} uiSkin="old-manor" /></SceneTransitionProvider></GameSessionScope>);
  await enter();
  await click(screen.getByRole("button", { name: "ROLL" })); await finish();
  await click(screen.getByRole("button", { name: "END TURN" })); await finish();
  const view = () => f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  expect(view().battle!.phase).toBe("roll");
  const food = view().supplies.find(s => s.definition.id === "item.food")!;
  const wounded = food.targets.find(t => t.kind === "member")!;
  if (wounded.kind !== "member") throw Error("Expected a wounded member");
  await click(screen.getByRole("button", { name: "打开道具坞" }));
  await click(screen.getByRole("button", { name: `食物，剩余 ${food.charges} 次` }));
  const name = wounded.id === "kael" ? "你" : view().party.find(p => p.id === wounded.id)!.name;
  await click(screen.getByRole("button", { name })); await finish();
  expect(view().supplies.find(s => s.definition.id === "item.food")!.charges).toBe(food.charges - 1);
});
