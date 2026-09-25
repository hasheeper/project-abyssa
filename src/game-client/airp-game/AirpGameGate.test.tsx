import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { formalAirpFixture, formalNodeText, formalRead } from "../../game-application/testing/airp-game-fixture";
import { airpGameView } from "../../game-runtime/airp-game-runtime";
import { GameSession } from "../session";
import { GameSessionScope } from "../react";
import { AirpGameGate } from "./AirpGameGate";
import { emptyUsage } from "../../game-application/airp-generation/contracts";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { backgroundTasks, disposeBackgroundTasks, registerBackgroundFactory } from "../airp-generation/background-tasks";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import * as routing from "../../shared/routing/location";

vi.mock("../airp-generation/DirectAiSettings", () => ({ DirectAiSettings: () => <span>连接设置</span> }));
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: vi.fn(() => ({ cancel() {}, finished: Promise.resolve() })) });
});
afterEach(() => { cleanup(); disposeBackgroundTasks(); vi.restoreAllMocks(); });

it("confirms a saved plan and leaves no outgoing MAP notification after entering battle",async()=>{
  const f=await formalAirpFixture(),id=await f.prepare();
  const session=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(session,()=>createPlayerRuntime(f.store,{newId:()=>"departure-host",newSeed:()=>1,close(){}}));
  await session.refresh();
  const navigate=vi.spyOn(routing,"navigateTo").mockReturnValue(true),fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(Error("Unexpected network call"));
  render(<UiMotionProvider preference="reduced"><GameSessionScope session={session}><AirpGameGate><p>地图页面</p></AirpGameGate></GameSessionScope></UiMotionProvider>);
  fireEvent.click(screen.getByRole("button",{name:"确认出征"}));
  await waitFor(()=>expect(navigate).toHaveBeenCalledOnce(),{timeout:10000});
  expect(navigate.mock.calls[0][0]).toMatch(/^#\/battle\?/);
  expect(f.raw().airpGame!.gm.jobs.find(j=>j.id===id)?.status).toBe("started");
  cleanup();
  expect(backgroundTasks.getSnapshot().some(t=>t.lane==="plan")).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
  session.dispose();
},20000);
async function setup(started = false, beforeRender?: (f: Awaited<ReturnType<typeof formalAirpFixture>>) => Promise<void>) {
  const f = await formalAirpFixture();
  if (started) {
    const id = await f.prepare(), permit = await f.flow.gm.departurePermit(id);
    await f.send({ type: "start-expedition", ...permit.departure }); await f.flow.sync();
  } else await f.flow.prepare(f.departure);
  await beforeRender?.(f);
  const notify = vi.fn(), session = new GameSession(f.runtime, { saveId: "formal-airp", epoch: "epoch:1" }, { getItem: () => null, setItem() {}, removeItem() {} }, notify);
  await session.refresh();
  const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network call"));
  render(<UiMotionProvider preference="reduced"><GameSessionScope session={session}><AirpGameGate><p>游戏页面</p></AirpGameGate></GameSessionScope></UiMotionProvider>);
  return { ...f, session, fetch, notify };
}
it("mounts saved preparation without API calls; minimizes and reopens from its task notice without cancelling", async () => {
  const f = await setup();
  expect(screen.getByRole("button", { name: "生成本次安排" })).toBeEnabled();
  const head = f.raw().head;
  fireEvent.click(screen.getByRole("button", { name: "收起，任务继续保留" }));
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByText("游戏页面")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /出征安排.*查看进度/ }));
  expect(screen.getByRole("button", { name: "生成本次安排" })).toBeInTheDocument();
  expect(f.raw().head).toEqual(head); expect(f.fetch).not.toHaveBeenCalled(); f.session.dispose();
}, 20000);
it("explicit facts-only exit completes the read scene without any network call", async () => {
  let nodeId = "";
  const f = await setup(true, async f => {
    nodeId = airpGameView(f.raw())!.node!.id;
    await formalNodeText(f, nodeId); await formalRead(f, nodeId);
  });
  fireEvent.click(screen.getByRole("button", { name: "仅记程序事实并继续（不评估关系与叙事状态）" }));
  await waitFor(() => expect(f.raw().airpGame!.settlement.jobs[0]?.status).toBe("applied"), { timeout: 10000 });
  await waitFor(() => expect(Object.values(f.raw().airpGame!.nodes).flatMap(n => n.jobs).find(j => j.id === nodeId)?.status).toBe("completed"), { timeout: 10000 });
  expect(f.raw().airpGame!.settlement.jobs[0].mode).toBe("program-only");
  expect(f.fetch).not.toHaveBeenCalled(); f.session.dispose();
}, 25000);
it("offers the real current node on load without generating or advancing combat", async () => {
  const f = await setup(true), run = f.raw().snapshot.run;
  expect(screen.getByRole("button", { name: "生成这场对白" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "确认出征" })).not.toBeInTheDocument();
  expect(f.raw().snapshot.run).toEqual(run); expect(f.fetch).not.toHaveBeenCalled(); f.session.dispose();
}, 20000);

it("opens saved dialogue and switches AVG/NVL/LOG without leaving, reading or calling APIs", async () => {
  const f = await setup(true, async f => {
    await formalNodeText(f, airpGameView(f.raw())!.node!.id);
  });
  const before = f.raw();
  expect(document.querySelector(".scene-sequence")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"开始阅读"}));
  await waitFor(()=>expect(document.querySelector(".scene-sequence")).not.toBeNull());
  const sequence = document.querySelector(".scene-sequence")!;
  expect(sequence).toHaveAttribute("data-scene", "adv");
  expect(sequence.parentElement).toHaveClass("airp-reader--embedded");
  expect(sequence.closest(".abyssa-stage__canvas")).not.toBeNull();
  expect(sequence.querySelector(".abyssa-stage__canvas")).toBeNull();
  expect(document.querySelector('[data-character="kael"]')).toBeNull();
  await waitFor(() => expect(sequence).toHaveAttribute("data-phase", "idle"), { timeout: 5000 });
  const entered = f.raw();
  expect(airpGameView(entered)!.node!.shown).toBe(true);
  expect(airpGameView(entered)!.node!.reads).toEqual([]);
  expect(entered.snapshot).toEqual(before.snapshot);
  expect(screen.queryByRole("button", {name:"关闭当前场景（保留进度）"})).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "切换为 NVL 舞台" }));
  await screen.findByLabelText("NVL 消息流");
  await waitFor(() => expect(screen.getByRole("button", { name: "回看已读对白" })).toBeEnabled());
  expect(document.querySelector('[data-character="kael"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "回看已读对白" }));
  expect(document.querySelector(".abyssa-rp")).toHaveAttribute("data-mode", "log");
  fireEvent.click(screen.getByRole("button", { name: "关闭回看" }));
  fireEvent.click(screen.getByRole("button", { name: "切换为 AVG 舞台" }));
  await screen.findByLabelText("AVG 对话");
  await waitFor(() => expect(screen.getByRole("button", {name:"切换为 NVL 舞台"})).toBeEnabled());
  expect(document.querySelector(".scene-sequence")).toBe(sequence);
  expect(sequence).toHaveAttribute("data-phase", "idle");
  fireEvent.keyDown(screen.getByLabelText("AVG 对话"), {key:"Escape"});
  expect(screen.getByLabelText("AVG 对话")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(f.raw()).toEqual(entered);
  expect(f.fetch).not.toHaveBeenCalled();
  f.session.dispose();
}, 20000);

it("restores directly to AVG after entry even with no acknowledged paragraphs", async () => {
  const f = await setup(true, async f => { await formalNodeText(f, airpGameView(f.raw())!.node!.id); });
  fireEvent.click(screen.getByRole("button", {name:"开始阅读"}));
  await waitFor(() => expect(airpGameView(f.raw())!.node!.shown).toBe(true), {timeout:5000});
  cleanup();
  const restored = new GameSession(f.runtime, {saveId:"formal-airp",epoch:"epoch:1"}, {getItem:()=>null,setItem(){},removeItem(){}});
  await restored.refresh();
  render(<UiMotionProvider preference="reduced"><GameSessionScope session={restored}><AirpGameGate><p>游戏页面</p></AirpGameGate></GameSessionScope></UiMotionProvider>);
  expect(document.querySelector(".scene-sequence")).toBeInTheDocument();
  expect(screen.queryByRole("button", {name:"开始阅读"})).toBeNull();
  expect(screen.queryByRole("button", {name:"关闭当前场景（保留进度）"})).toBeNull();
  expect(document.querySelector(".flow-scene")).toBeNull();
  expect(airpGameView(f.raw())!.node!.reads).toEqual([]);
  expect(f.fetch).not.toHaveBeenCalled();
  restored.dispose(); f.session.dispose();
}, 20000);

it("offers postprocessing for a saved imperfect draft and exposes its log without making a network call", async () => {
  const f = await setup(true, async f => {
    const id = airpGameView(f.raw())!.node!.id; await f.flow.nodes.open(id);
    await f.flow.nodes.begin(id, { id: "invalid-writing", stage: "writing", model: "mock", connectionHash: "2".repeat(64), at: 1 });
    await f.flow.nodes.result(id, "invalid-writing", "incomplete original", emptyUsage(), 2);
  });
  const before = f.raw();
  expect(screen.getByRole("button", { name: "继续后处理" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  const details = screen.getByText("调用记录 · 1").closest('details')!;
  expect(details).not.toHaveAttribute('open');
  details.open = true; fireEvent(details, new Event("toggle"));
  expect(screen.getByText(/incomplete original/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导出调用日志" })).toBeInTheDocument();
  expect(f.raw()).toEqual(before); expect(f.fetch).not.toHaveBeenCalled(); f.session.dispose();
}, 20000);

it("SKIP commits ordinary reads in order and stops before final acknowledgement, choice or generation", async () => {
  const f = await setup(true, async f => {await formalNodeText(f, airpGameView(f.raw())!.node!.id);});
  try {
    const node = airpGameView(f.raw())!.node!, run = f.raw().snapshot.run;
    fireEvent.click(screen.getByRole("button",{name:"开始阅读"}));
    await waitFor(() => expect(screen.getByRole("button", {name:"跳过本段对白"})).toBeEnabled(), {timeout:5000});
    fireEvent.click(screen.getByRole("button", {name:"跳过本段对白"}));
    await waitFor(() => expect(airpGameView(f.raw())!.node!.reads).toHaveLength(node.text!.lines.length-1), {timeout:10000});
    await waitFor(() => expect(screen.getByRole("button", {name:"确认本段已读"})).toBeEnabled());
    expect(screen.getByRole("button", {name:"自动播放"})).toBeDisabled();
    expect(screen.getByRole("button", {name:"跳过本段对白"})).toBeDisabled();
    expect(airpGameView(f.raw())!.node!.selected).toBeNull();
    expect(f.raw().snapshot.run).toEqual(run);
    fireEvent.click(screen.getByRole("button", {name:"确认本段已读"}));
    await waitFor(() => expect(airpGameView(f.raw())!.node!.reads).toHaveLength(node.text!.lines.length), {timeout:5000});
    await waitFor(() => expect(screen.getByRole("button", {name:node.text!.choices[0]})).toBeEnabled());
    expect(airpGameView(f.raw())!.node!.selected).toBeNull();
    expect(f.raw().snapshot.run).toEqual(run); expect(f.fetch).not.toHaveBeenCalled();
  } finally {f.session.dispose();}
}, 25000);
