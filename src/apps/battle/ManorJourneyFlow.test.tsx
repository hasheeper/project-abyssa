import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { manorClientFixture } from "../../game-client/testing/manor";
import { journeyOf, playToJourney } from "../../game-client/testing/journey-flow";
import { GameSessionScope } from "../../game-client/react";
import { SceneTransitionProvider } from "../../shared/transition";
import { ManorBattleView } from "./ManorBattleView";
import { useManorBattlePresentation } from "./controller/useManorBattlePresentation";
// These tests exercise the battle/mechanical surface. StorySceneFlow covers the director.
function ManorMechanics() {const p=useManorBattlePresentation(); return <ManorBattleView presentation={p} onSettle={() => {}} uiSkin="old-manor"/>;}
import { JOURNEY_MOTION_MS } from "./presentation/journey-motion";

type Fixture = Awaited<ReturnType<typeof manorClientFixture>>;
const fixtures: Fixture[] = [];
afterEach(() => { cleanup(); fixtures.splice(0).forEach(f => f.session.dispose()); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function setup(version: 2 | 3 | 4 = 2, stop: Parameters<typeof playToJourney>[1] = v => v.expedition?.node === "room-complete", itemIds?: string[]) {
  const f = await manorClientFixture(19, version, itemIds); fixtures.push(f);
  await playToJourney(f, stop);
  vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
  render(<GameSessionScope session={f.session}><SceneTransitionProvider><ManorMechanics/></SceneTransitionProvider></GameSessionScope>);
  return {f, board: screen.getByRole("main", {name: "克雷格旧庄园战斗界面"})};
}
async function click(node: Element) { await act(async () => { fireEvent.click(node); }); }
async function finish() { await act(async () => { await vi.runAllTimersAsync(); }); }
async function elapse(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

it.each([2, 3, 4] as const)("v%i：间歇→空事件回执→阅读结果内嵌，连点只推进一次", async version => {
  const {f, board} = await setup(version);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", {name: "扎营 · 未开放"})).toBeDisabled();
  const dispatch = vi.spyOn(f.session, "dispatch");
  const previous = journeyOf(f).roomId;
  const button = screen.getByRole("button", {name: "继续前进"});
  await act(async () => {fireEvent.click(button);fireEvent.click(button);});
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(journeyOf(f).roomId).not.toBe(previous);
  expect(journeyOf(f).expedition?.node).toBe("event");
  const batch = await dispatch.mock.results[0].value;
  expect(batch.receipts.every((r: {events: unknown[]}) => r.events.length === 0)).toBe(true);
  expect(board).toHaveAttribute("data-journey-motion", "walking");
  expect(screen.queryByRole("button", {name: "阅读迎宾簿"})).toBeNull();
  await elapse(JOURNEY_MOTION_MS.walking);
  expect(board).toHaveAttribute("data-journey-motion", "arriving");
  expect(board.querySelector(".abyssa-expedition-encounter-flash")).toBeNull();
  await finish();
  expect(board).not.toHaveAttribute("data-journey-motion");
  await click(screen.getByRole("button", {name: "阅读迎宾簿"})); await finish();
  expect(journeyOf(f).lastEvent?.method).toBe("read");
  expect(screen.getByRole("heading", {name: "记录已阅"})).toBeVisible();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(board).not.toHaveTextContent("层已入袋");
  expect(board.querySelectorAll(".abyssa-expedition-party-card")).toHaveLength(5);
}, 60000);

it("整理选择用真实伙伴卡；确认只支付一次，结果与刷新后的存档一致", async () => {
  const {f, board} = await setup(4, v => v.expedition?.node === "event" && v.event?.kind === "relic");
  const before = journeyOf(f), actor = before.party.filter(m => m.hp > 0).at(-1)!;
  const card = board.querySelector(`[data-character="${actor.id}"]`)!;
  const rng = structuredClone(before.expedition!.run.eventRng);
  await act(async () => {fireEvent.keyDown(card, {key: "Enter"});});
  expect(card).toHaveAttribute("aria-pressed", "true");
  expect(journeyOf(f).expedition!.run.eventRng).toEqual(rng);
  const button = screen.getByRole("button", {name: "ROLL"});
  const dice = [...board.querySelectorAll<HTMLElement>(".abyssa-expedition-die-slot")];
  const otherTransforms = dice.filter(d => d.dataset.owner !== actor.id).map(d => d.querySelector(".expedition-die__cube")!.getAttribute("style"));
  const reactionBefore = board.querySelector(".battle-reaction")!.getAttribute("data-actor");
  await act(async () => {fireEvent.click(button);fireEvent.click(button);});
  const rolling = board.querySelector<HTMLElement>(".expedition-die[data-rolling]")!;
  expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(1);
  expect(rolling.closest("[data-owner]")).toHaveAttribute("data-owner", actor.id);
  expect(screen.getByRole("complementary", {name: "整理判定"})).toHaveTextContent("掷骰中");
  expect(screen.queryByRole("complementary", {name: "整理结果"})).toBeNull();
  expect(board.querySelector(".battle-reaction")).toHaveAttribute("data-actor", reactionBefore!);
  expect(dice.filter(d => d.dataset.owner !== actor.id).map(d => d.querySelector(".expedition-die__cube")!.getAttribute("style"))).toEqual(otherTransforms);
  const rollMs = parseFloat(rolling.style.getPropertyValue("--expedition-die-roll-duration")) * 1000;
  await act(async () => {await vi.advanceTimersByTimeAsync(rollMs + 121);});
  expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
  expect(board.querySelector(".manor-journey")).toHaveAttribute("data-event-phase", "checking");
  expect(screen.getByRole("complementary", {name: "整理判定"})).toHaveTextContent("核对行动与命数条件");
  expect(screen.queryByRole("complementary", {name: "整理结果"})).toBeNull();
  await finish();
  const after = journeyOf(f), result = after.lastEvent!;
  expect(result.actorId).toBe(actor.id);
  // The final event in a layer automatically banks its raw loose gold.
  expect(after.expedition!.run.layerResults.find(r => r.layer === before.expedition!.run.layer)!.looseGold).toBe(before.expedition!.run.looseGold - result.cost + result.reward);
  expect(after.expedition!.run.eventResults.filter(r => r.roomId === before.roomId)).toHaveLength(1);
  expect(screen.getByRole("complementary", {name: "整理结果"})).toHaveTextContent(actor.name);
  expect(screen.getByLabelText("判定依据")).toHaveTextContent("行动判定");
  const landedDie = board.querySelector(`[data-owner="${actor.id}"] .expedition-die`)!;
  expect(landedDie).toHaveAttribute("title", actor.faces.find(f => f.id === result.faceId)!.name);
  const landedTransform = landedDie.querySelector(".expedition-die__cube")!.getAttribute("style");
  await act(async () => {await f.session.refresh();});
  expect(journeyOf(f).lastEvent).toEqual(result);
  expect(landedDie.querySelector(".expedition-die__cube")).toHaveAttribute("style", landedTransform!);
  expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
  expect(board).not.toHaveAttribute("data-journey-motion");
  expect(screen.queryByRole("dialog")).toBeNull();
}, 60000);

it.each(["refresh", "hidden", "reduced"])("整理掷骰 %s：直接保留已提交骰面和结果，不多扣费或重掷", async mode => {
  const {f, board} = await setup(2, v => v.expedition?.node === "event" && v.event?.kind === "relic");
  if (mode === "reduced") vi.stubGlobal("matchMedia", () => ({matches: true}));
  await click(screen.getByRole("button", {name: "ROLL"}));
  const result = journeyOf(f).lastEvent, head = f.session.getSnapshot().record!.head;
  if (mode === "refresh") await act(async () => {await f.session.refresh();});
  if (mode === "hidden") await act(async () => {vi.spyOn(document, "hidden", "get").mockReturnValue(true);document.dispatchEvent(new Event("visibilitychange"));});
  expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
  expect(screen.getByRole("complementary", {name: "整理结果"})).toBeVisible();
  await finish();
  expect(journeyOf(f).lastEvent).toEqual(result);
  expect(f.session.getSnapshot().record!.head).toEqual(head);
}, 60000);

it("整理保存失败不演骰，不提前显示结果或成功台词", async () => {
  const {f, board} = await setup(2, v => v.expedition?.node === "event" && v.event?.kind === "relic");
  const before = journeyOf(f).expedition!.run.eventRng;
  const reaction = board.querySelector(".battle-reaction__name")?.textContent;
  vi.spyOn(f.store, "commit").mockRejectedValueOnce(Error("disk offline"));
  await click(screen.getByRole("button", {name: "ROLL"})); await finish();
  expect(journeyOf(f).expedition!.run.eventRng).toEqual(before);
  expect(screen.queryByRole("complementary", {name: "整理结果"})).toBeNull();
  expect(board.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
  expect(board.querySelector(".battle-reaction__name")?.textContent).toBe(reaction);
}, 60000);

it("事件道具侦察留在同一舞台；绕行不消耗事件 RNG 或散金", async () => {
  const {f} = await setup(2, v => v.expedition?.node === "event" && v.event?.kind === "relic", ["item.food", "item.potion", "item.divination-slip"]);
  const before = journeyOf(f), item = before.supplies.find(s => s.definition.kind === "divination-slip")!;
  await click(screen.getByRole("button", {name: "打开道具坞"}));
  await click(screen.getByRole("button", {name: `${item.definition.name}，剩余 ${item.charges} 次`}));
  await click(screen.getByRole("button", {name: "查看当前事件"})); await finish();
  expect(journeyOf(f).eventRevealed).toBe(true);
  expect(screen.getByRole("heading", {name: before.event!.name})).toBeVisible();
  await click(screen.getByRole("button", {name: "返回行动"}));
  await click(screen.getByRole("button", {name: "绕行"})); await finish();
  const after = journeyOf(f);
  expect(after.lastEvent?.method).toBe("skip");
  expect(after.expedition!.run.eventRng).toEqual(before.expedition!.run.eventRng);
  expect(after.expedition!.run.layerResults.find(r => r.layer === before.expedition!.run.layer)!.looseGold).toBe(before.expedition!.run.looseGold);
}, 60000);

it("保存失败不走路也不跳房间，恢复同一请求后不重演", async () => {
  const {f, board} = await setup();
  const before = journeyOf(f);
  vi.spyOn(f.store, "commit").mockRejectedValueOnce(Error("disk offline"));
  await click(screen.getByRole("button", {name: "继续前进"})); await finish();
  expect(f.session.getSnapshot().status).toBe("error");
  expect(journeyOf(f).roomId).toBe(before.roomId);
  expect(board).not.toHaveAttribute("data-journey-motion");
  await act(async () => {await f.session.refresh();});
  expect(f.session.getSnapshot().status).toBe("ready");
  expect(journeyOf(f).expedition?.node).toBe("event");
  expect(board).not.toHaveAttribute("data-journey-motion");
}, 60000);

it.each(["refresh", "hidden", "reduced"])("%s 直接恢复已提交节点，不等待或重播走路", async mode => {
  const {f, board} = await setup();
  if (mode === "reduced") vi.stubGlobal("matchMedia", () => ({matches: true}));
  await click(screen.getByRole("button", {name: "继续前进"}));
  const head = f.session.getSnapshot().record!.head;
  if (mode === "refresh") await act(async () => {await f.session.refresh();});
  if (mode === "hidden") await act(async () => {vi.spyOn(document, "hidden", "get").mockReturnValue(true); document.dispatchEvent(new Event("visibilitychange"));});
  expect(board).not.toHaveAttribute("data-journey-motion");
  expect(screen.getByRole("button", {name: "阅读迎宾簿"})).toBeVisible();
  await finish();
  expect(f.session.getSnapshot().record!.head).toEqual(head);
}, 60000);

it("另一标签已推进时旧 head 请求不再推进或播放抵达", async () => {
  const {f, board} = await setup();
  const before = journeyOf(f);
  const committed = await f.runtime.application.dispatch({protocolVersion: 2, saveId: "manor-save",
    expectedHead: f.session.getSnapshot().record!.head, clientRequestId: "other-tab",
    command: {type: "advance-room", runRef: {kind: "expedition", id: "manor-run"}, roomId: before.roomId!}});
  expect(committed.ok).toBe(true);
  await click(screen.getByRole("button", {name: "继续前进"})); await finish();
  expect(f.session.getSnapshot().error?.code).toBe("conflict");
  expect(journeyOf(f).expedition?.node).toBe("event");
  expect(board).not.toHaveAttribute("data-journey-motion");
  await act(async () => {await f.session.refresh();});
  expect(screen.getByRole("button", {name: "阅读迎宾簿"})).toBeEnabled();
}, 60000);

it("旧三层出口没有深入按钮，带宝离场后保留终局弹窗", async () => {
  const {f} = await setup(2, v => v.expedition?.node === "exit");
  expect(screen.queryByRole("button", {name: "深入宴会厅"})).toBeNull();
  await click(screen.getByRole("button", {name: "带宝离场"})); await finish();
  expect(journeyOf(f).expedition?.result?.outcome).toBe("extracted");
  expect(screen.getByRole("dialog", {name: "远征结束"})).toBeVisible();
  expect(screen.getByRole("button", {name: "返回洋馆"})).toBeEnabled();
}, 60000);

it("三层出口继续：旧背景缩放与白闪完成后才挂载第四层敌人", async () => {
  const {f, board} = await setup(4, v => v.expedition?.node === "exit");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", {name: "带宝离场"})).toBeEnabled();
  await click(screen.getByRole("button", {name: "深入宴会厅"}));
  expect(board).toHaveAttribute("data-journey-motion", "walking");
  const head = f.session.getSnapshot().record!.head;
  expect(journeyOf(f).expedition!.node).toBe("battle");
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
  await elapse(JOURNEY_MOTION_MS.walking);
  expect(board).toHaveAttribute("data-journey-motion", "encounter");
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
  expect(board.querySelector(".abyssa-expedition-encounter-flash")).toBeNull();
  await elapse(JOURNEY_MOTION_MS.encounter);
  expect(board).toHaveAttribute("data-journey-motion", "flash");
  expect(board.querySelector(".abyssa-expedition-encounter-flash")).toBeInTheDocument();
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
  await elapse(JOURNEY_MOTION_MS.flash);
  expect(board).toHaveAttribute("data-journey-motion", "revealing");
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(4);
  expect(screen.getByRole("button", {name: "ROLL"})).toBeDisabled();
  await finish();
  expect(board).not.toHaveAttribute("data-journey-motion");
  expect(board.querySelector(".abyssa-expedition-encounter-flash")).toBeNull();
  expect(f.session.getSnapshot().record!.head).toEqual(head);
  expect(journeyOf(f).expedition!.run.layer).toBe(4);
  expect(journeyOf(f).expedition!.node).toBe("battle");
  expect(screen.getByRole("button", {name: "ROLL"})).toBeEnabled();
}, 60000);

it("记录事件后的推进也触发遭遇；连点只提交一次，敌人不提前出现", async () => {
  const {f, board} = await setup(4, v => v.expedition?.node === "room-complete" && v.lastEvent?.method === "read");
  const dispatch = vi.spyOn(f.session, "dispatch");
  const button = screen.getByRole("button", {name: "继续前进"});
  await act(async () => {fireEvent.click(button);fireEvent.click(button);});
  expect(dispatch).toHaveBeenCalledTimes(1);
  await elapse(JOURNEY_MOTION_MS.walking);
  expect(board).toHaveAttribute("data-journey-motion", "encounter");
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
  await finish();
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(3);
  expect(screen.getByRole("button", {name: "ROLL"})).toBeEnabled();
}, 60000);

it.each(["refresh", "hidden", "reduced", "failed"])("遭遇过渡 %s：不残留白幕，不重放或重复推进", async mode => {
  const {f, board} = await setup(2, v => v.expedition?.node === "room-complete" && v.lastEvent?.method === "read");
  const before = f.session.getSnapshot().record!.head;
  if (mode === "reduced") vi.stubGlobal("matchMedia", () => ({matches: true}));
  if (mode === "failed") vi.spyOn(f.store, "commit").mockRejectedValueOnce(Error("disk offline"));
  await click(screen.getByRole("button", {name: "继续前进"}));
  const head = f.session.getSnapshot().record!.head;
  if (mode === "refresh" || mode === "hidden") {
    await elapse(JOURNEY_MOTION_MS.walking);
    await elapse(JOURNEY_MOTION_MS.encounter);
    expect(board).toHaveAttribute("data-journey-motion", "flash");
    if (mode === "refresh") await act(async () => {await f.session.refresh();});
    else await act(async () => {vi.spyOn(document, "hidden", "get").mockReturnValue(true);document.dispatchEvent(new Event("visibilitychange"));});
  }
  await finish();
  expect(board).not.toHaveAttribute("data-journey-motion");
  expect(board.querySelector(".abyssa-expedition-encounter-flash")).toBeNull();
  expect(f.session.getSnapshot().record!.head).toEqual(head);
  if (mode === "failed") {
    expect(head).toEqual(before);
    expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
  } else {
    expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(3);
    expect(screen.getByRole("button", {name: "ROLL"})).toBeEnabled();
  }
}, 60000);
