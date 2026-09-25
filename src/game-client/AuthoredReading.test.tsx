import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GrowthStory } from "./GrowthStory";
import { MemoryStory } from "./MemoryStory";
import { growthStories } from "../content/presentation/growth-stories";
import { clockworkMemoryScript } from "../content/presentation/clockwork-memory";
import { mariettaMemoryScript } from "../content/presentation/marietta-memory";
import { isUserChoice } from "../content/presentation/authored-story";
import type { AdvStageProps } from "../shared/presentation/adv/AdvStage";

// Real scripts, shared reader/choices/controls; isolate persistence and portrait art.
const mock = vi.hoisted(() => ({state: {} as any, memory: {} as any, dispatch: vi.fn(), navigate: vi.fn()}));
vi.mock("./react", () => ({useGameState: () => mock.state, useGameSession: () => ({
  dispatch: mock.dispatch, getSnapshot: () => mock.state, runtime: {queries: {memory: () => mock.memory}},
})}));
vi.mock("../shared/transition", () => ({useSceneTransition: () => ({navigate: mock.navigate})}));
vi.mock("./GameOperationFeedback", () => ({GameOperationFeedback: () => null}));
vi.mock("../shared/presentation/adv/AdvStage", () => ({AdvStage: (p: AdvStageProps) => <div>
  <button onClick={p.onTypingEnd}>完成打字</button>
  {p.messages.filter(m => m.kind === "narration" || m.kind === "say").map(m => <p key={m.id}>{m.text}</p>)}
</div>}));
beforeEach(() => {
  vi.useFakeTimers(); mock.dispatch.mockReset().mockResolvedValue({}); mock.navigate.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {configurable: true, value: vi.fn()});
  Object.defineProperty(HTMLElement.prototype, "animate", {configurable: true, value: vi.fn(() => ({cancel() {}, finished: Promise.resolve()}))});
  mock.state = {status: "ready", error: null, record: {schemaVersion: 4, facts: [], head: {saveId: "test", epoch: "test"}, snapshot: {campaign: {
    activeStoryId: "growth", stories: [{id: "growth", eventId: "event.growth.eustice.lv2", step: 0, choices: []}],
  }}}};
  mock.memory = {memory: {id: "memory", templateId: "profile.memory.clockwork.v1", attempt: 1, node: "history-opening", step: 0, choices: []}};
});
afterEach(() => {cleanup(); vi.useRealTimers(); vi.restoreAllMocks();});
const tick = (ms: number) => act(async () => {await vi.advanceTimersByTimeAsync(ms);});
const growth = () => <GrowthStory eventId="event.growth.eustice.lv2" review={false} onClose={vi.fn()} onCompleted={vi.fn()}/>;

it.each(["growth", "memory"])("shares every base control and read-only review in %s", async kind => {
  const view = render(kind === "growth" ? growth() : <MemoryStory/>);
  expect([...view.container.querySelectorAll(".rp-app__tools .rp-app__cell-label")].slice(0, 5).map(e => e.textContent))
    .toEqual(["NVL", "REPLAY", "LOG", "AUTO", "SKIP"]);
  expect(screen.getByRole("button", {name:kind === "growth" ? "稍后继续" : "返回洋馆"}).querySelector('[data-glyph="back"]')).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "从头重播"}));
  expect(screen.getByRole("button", {name: "自动播放"})).toBeDisabled();
  fireEvent.click(within(screen.getByRole("navigation", {name: "演出控制"})).getByRole("button", {name: "返回当前进度"}));
  fireEvent.click(screen.getByRole("button", {name: "切换为 NVL 舞台"})); await tick(600);
  fireEvent.click(screen.getByRole("button", {name: "回看已读对白"}));
  expect(view.container.querySelector(".abyssa-rp")).toHaveAttribute("data-mode", "log");
  expect(mock.dispatch).not.toHaveBeenCalled(); expect(mock.navigate).not.toHaveBeenCalled();
});

it("growth keeps authored tone choices and restores the same choice after a failed commit", async () => {
  const script = growthStories["event.growth.eustice.lv2"], step = script.lines.findIndex(isUserChoice);
  const choice = script.lines[step]; if (!isUserChoice(choice)) throw Error("Missing authored choice");
  mock.state.record.snapshot.campaign.stories[0].step = step;
  mock.dispatch.mockResolvedValueOnce(null).mockResolvedValue({});
  render(growth());
  expect(screen.getByRole("button", {name: "自动播放"})).toBeDisabled();
  expect(screen.getByRole("button", {name: "跳过本段对白"})).toBeDisabled();
  await act(async () => {fireEvent.click(screen.getByRole("button", {name: choice.options[1].label}));});
  expect(mock.dispatch).toHaveBeenLastCalledWith({type: "advance-story", sessionId: "growth", step, choice: "seasoned"});
  expect(screen.getByRole("alert")).toHaveTextContent("选择未能提交");
  expect(screen.getByRole("button", {name: choice.options[1].label})).toBeEnabled();
  await act(async () => {fireEvent.click(screen.getByRole("button", {name: choice.options[1].label}));});
  expect(mock.dispatch).toHaveBeenCalledTimes(2);
});

it.each([true, false])("memory stops at the last teaching line until explicit battle confirmation (clockwork=%s)", async clockwork => {
  const lines = (clockwork ? clockworkMemoryScript : mariettaMemoryScript).teaching;
  mock.memory.memory = {...mock.memory.memory, templateId: clockwork ? "profile.memory.clockwork.v1" : "profile.memory.marietta.v1", node: "teaching", step: lines.length - 1};
  render(<MemoryStory/>);
  fireEvent.click(screen.getByRole("button", {name: "跳过本段对白"})); await tick(5000);
  expect(screen.getByRole("button", {name: "自动播放"})).toBeDisabled();
  expect(screen.getByRole("button", {name: "跳过本段对白"})).toBeDisabled();
  expect(mock.dispatch).not.toHaveBeenCalled();
  await act(async () => {fireEvent.click(screen.getByRole("button", {name: clockwork ? "迎战刻仪兽" : "迎战提线魔女"}));});
  expect(mock.dispatch).toHaveBeenCalledExactlyOnceWith({type: "advance-memory", runRef: {kind: "memory", id: "memory", attempt: 1}, node: "battle", choice: "continue"});
});

it("memory routes the authored choice through read-memory rather than advancing the chapter", async () => {
  const step = clockworkMemoryScript["history-opening"].findIndex(isUserChoice), choice = clockworkMemoryScript["history-opening"][step];
  if (!isUserChoice(choice)) throw Error("Missing memory choice");
  mock.memory.memory.step = step; render(<MemoryStory/>);
  await act(async () => {fireEvent.click(screen.getByRole("button", {name: choice.options[2].label}));});
  expect(mock.dispatch).toHaveBeenCalledExactlyOnceWith({type: "read-memory", runRef: {kind: "memory", id: "memory", attempt: 1}, node: "history-opening", step, choice: "pragmatic"});
});
