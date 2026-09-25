import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import type { D5GameRecord } from "../../game-application";
import { CampaignMenuScope } from "../../game-client/CampaignMenuScope";
import { CampaignPanel } from "../../game-client/CampaignPanel";
import { GameSessionScope } from "../../game-client/react";
import { GameSession } from "../../game-client/session";
import { tideClientFixture, tideCommand, tideOperation } from "../../game-client/testing/tide-cave";
import { SceneTransitionProvider } from "../../shared/transition";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { useManorBattlePresentation } from "./controller/useManorBattlePresentation";
import { ManorBattleView } from "./ManorBattleView";

let fixture: Awaited<ReturnType<typeof tideClientFixture>>;
beforeAll(async () => {
  fixture = await tideClientFixture("current");
  await fixture.start();
  for (let n = 0; n < 40; n++) {
    const record = fixture.session.getSnapshot().record as D5GameRecord;
    const view = fixture.runtime.queries.journey(record)!;
    if (view.tutorial?.stage === "active" && view.battle) return;
    const operation = tideOperation(record);
    if (!operation) throw Error("Tutorial did not reach the first battle");
    await fixture.send(tideCommand(operation));
  }
  throw Error("Tutorial did not reach the first battle");
});
afterEach(cleanup);
afterAll(() => fixture?.session.dispose());

function Battle() {
  const presentation = useManorBattlePresentation();
  return <>
    <ManorBattleView presentation={presentation} onSettle={() => {}} uiSkin="hero-party"/>
    <CampaignPanel/>
  </>;
}
const click = async (element: Element) => { await act(async () => { fireEvent.click(element); }); };
const entryIds = (root: Element) => [...root.querySelectorAll<HTMLElement>("[data-icon]")].map(node => node.dataset.icon);

it("教学侧栏只保留帮助与系统入口，结束回合留在底部，退出带做后仍不恢复多余入口", async () => {
  render(<GameSessionScope session={fixture.session}><UiMotionProvider preference="reduced">
    <SceneTransitionProvider><CampaignMenuScope><Battle/></CampaignMenuScope></SceneTransitionProvider>
  </UiMotionProvider></GameSessionScope>);
  const rail = screen.getByRole("complementary", {name: "游戏导航"});
  const menu = within(rail);
  const expected = ["handbook", "battle-guide", "exit-guided", "archive", "save", "load", "settings"];
  expect(entryIds(rail)).toEqual(expected);
  expect(menu.getByRole("link", {name: "返回标题"})).toHaveAttribute("href", expect.stringContaining("title"));
  const endTurn = screen.getByRole("button", {name: "END TURN"});
  expect(rail.contains(endTurn)).toBe(false);

  await click(menu.getByRole("button", {name: "展开菜单"}));
  expect(entryIds(rail)).toEqual(expected);
  const before = fixture.session.getSnapshot().record!.head;
  await click(menu.getByRole("button", {name: "玩法手册"}));
  const handbook = screen.getByRole("dialog", {name: "战斗与探索规则总览"});
  expect(within(handbook).getByRole("article", {name: "界面与操作"})).toBeInTheDocument();
  expect(fixture.session.getSnapshot().record!.head).toEqual(before);
  await click(within(handbook).getByRole("button", {name: "关闭战斗与探索规则总览"}));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  await click(menu.getByRole("button", {name: "退出带做"}));
  await waitFor(() => expect(entryIds(rail)).toEqual(expected.filter(id => id !== "exit-guided")));
  expect(fixture.runtime.queries.tutorial(fixture.session.getSnapshot().record!)!.guide?.mode).toBe("free");
  expect(screen.getByRole("button", {name: "END TURN"})).toBeInTheDocument();
});

it("教学存档位于洋馆页面时不套用战斗侧栏限制", async () => {
  const {saveId, epoch} = fixture.session.locator;
  const mansion = new GameSession(fixture.runtime, {saveId, epoch}, fixture.storage);
  await mansion.refresh();
  try {
    render(<GameSessionScope session={mansion}><CampaignMenuScope><CampaignPanel/></CampaignMenuScope></GameSessionScope>);
    const rail = screen.getByRole("complementary", {name: "游戏导航"});
    expect(entryIds(rail)).toEqual(["menu", "mansion", "journey", "archive", "save", "load", "settings"]);
    expect(within(rail).getByRole("link", {name: "继续远征"})).toHaveAttribute("href", expect.stringContaining("expedition=tide-run"));
  } finally { cleanup(); mansion.dispose(); }
});
