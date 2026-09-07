import { CampaignMenuScope } from "../../game-client/CampaignMenuScope";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { manorClientFixture } from "../../game-client/testing/manor";
import { GameSessionScope } from "../../game-client/react";
import { ManorBattleBinding } from "./ManorBattleBinding";
import { SceneTransitionProvider } from "../../shared/transition";
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
  const board = screen.getByRole("main", { name: "克雷格旧庄园战斗界面" });
  await click(screen.getByRole("button", { name: "ROLL" }));
  await finish();
  /* 装载艾洛拉的骰子并拿起她：与裂隙版同一手势。 */
  await click(board.querySelector('[data-owner="elora"] .expedition-die')!);
  await finish();
  await click(board.querySelector('[data-character="elora"]')!);
  return { f, view, board };
};

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
  const read=() => f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  await click(screen.getByRole("button",{name:"打开道具坞"}));
  expect(screen.getByRole("list",{name:"携带道具"}).children).toHaveLength(7);
  const before=f.session.getSnapshot().record!.head.revision;
  await click(screen.getByRole("button",{name:"护符，剩余 2 次"}));
  expect(screen.queryByRole("dialog",{name:"护符"})).toBeNull();
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
});

it("左侧菜单读取最新合法状态，结束回合走现有提交，导航仅携带恢复链接", async () => {
  vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
  const f=await manorClientFixture();fixtures.push(f);
  render(<GameSessionScope session={f.session}><SceneTransitionProvider><CampaignMenuScope><ManorBattleBinding onSettle={() => {}} uiSkin="old-manor"/></CampaignMenuScope></SceneTransitionProvider></GameSessionScope>);
  await click(screen.getByRole("button",{name:"展开菜单"}));
  expect(screen.getByRole("button",{name:/结束回合/})).toBeDisabled();
  await click(screen.getByRole("button",{name:"收起菜单"}));
  await click(screen.getByRole("button",{name:"ROLL"}));await finish();
  const read=() => f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  const round=read().battle!.encounter.round;
  await click(screen.getByRole("button",{name:"展开菜单"}));
  expect(screen.getByRole("button",{name:/撤退/})).toBeDisabled();
  await click(screen.getByRole("button",{name:/结束回合/}));await finish();
  expect(read().battle!.encounter.round).toBe(round+1);
  const before=f.session.getSnapshot().record!.head.revision;
  await click(screen.getByRole("button",{name:"展开菜单"}));
  expect(screen.getByRole("link",{name:/继续远征/})).toHaveAttribute("href",expect.stringContaining("expedition=manor-run"));
  expect(f.session.getSnapshot().record!.head.revision).toBe(before);
});
