import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AdvStageProps } from "../shared/presentation/adv/AdvStage";
import { deriveRpStage } from "../shared/ui/patterns/rp-stage";
import { StoryReading } from "./StoryReading";
import { tideStory } from "../content/presentation/tide-cave";
import { UiMotionProvider } from "../shared/ui/motion/UiMotionProvider";

let stage: AdvStageProps;
vi.mock("../shared/presentation/adv/AdvStage",()=>({AdvStage:(props:AdvStageProps)=>{stage=props;return <div data-testid="stage"/>;}}));
afterEach(cleanup);
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {configurable: true, value: vi.fn()});
  Object.defineProperty(HTMLElement.prototype, "animate", {configurable: true, value: vi.fn(() => ({cancel() {}, finished: Promise.resolve()}))});
});

it("restores the authored cursor, leaves thoughts offstage and never performs a direction note", () => {
  const scene = tideStory("S3-1","final"), onNext = vi.fn();
  const view = render(<StoryReading {...scene} cursor={1} onNext={onNext}/>);
  expect(stage!.performances?.norma).toBeUndefined();
  expect(stage!.messages.filter(m=>m.kind==="stage")).toHaveLength(1);
  expect(JSON.stringify(stage!.messages)).not.toContain("刀尖");
  view.rerender(<StoryReading {...scene} cursor={2} onNext={onNext}/>);
  expect(stage!.messages.at(-1)).toMatchObject({kind:"say",actorId:"kael",offstage:true,text:"（……看来他们也没什么余裕。追上不难。）"});
  expect(Object.values(deriveRpStage(stage!.messages,stage!.initialSlots).slots)).not.toContain("kael");
  fireEvent.click(screen.getByRole("button",{name:"显示全文"}));
  expect(onNext).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"下一句"}));
  expect(onNext).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button",{name:"跳过本段对白"}));
  expect(screen.getByRole("button",{name:"停止快进"})).toBeInTheDocument();
});

it("reveals the last line before offering a choice and blocks reading controls during a commit", () => {
  const scene = tideStory("S3-4","final"), onNext = vi.fn(), onChoose = vi.fn();
  const props = {...scene,cursor:scene.lines.length-1,onNext,onChoose};
  const view = render(<StoryReading {...props}/>);
  expect(screen.queryByRole("button",{name:"守住出口"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"显示全文"}));
  fireEvent.click(screen.getByRole("button",{name:"堵住退路"}));
  expect(onChoose).toHaveBeenCalledWith("B");
  expect(onNext).not.toHaveBeenCalled();
  view.rerender(<StoryReading {...props} busy/>);
  expect(screen.getByRole("button",{name:"守住出口"})).toBeDisabled();
  expect(screen.getByRole("button",{name:"跳过本段对白"})).toBeDisabled();
});

it("shares NVL/LOG without advancing, leaking unread lines or letting jump-to-latest advance", async () => {
  const onNext = vi.fn(), onChoose = vi.fn();
  const lines = [{id: "n1", kind: "action" as const, text: "窗边已读。"}, {id: "n2", kind: "action" as const, text: "未读的下一段。"}];
  render(<UiMotionProvider preference="reduced"><StoryReading title="测试" location="洋馆" background="/bg.webp" lines={lines} cursor={0} onNext={onNext} onChoose={onChoose}/></UiMotionProvider>);
  fireEvent.click(screen.getByRole("button", {name: "切换为 NVL 舞台"}));
  await waitFor(() => expect(screen.getByRole("button", {name: "切换为 AVG 舞台"})).toBeEnabled());
  const nvl = screen.getByLabelText("NVL 消息流");
  expect(nvl).toHaveTextContent("窗边已读。");
  expect(nvl).not.toHaveTextContent("未读的下一段。");
  fireEvent.click(screen.getByRole("button", {name: "▼ 回到最新"}));
  expect(onNext).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "回看已读对白"}));
  expect(document.querySelector(".abyssa-rp")).toHaveAttribute("data-mode", "log");
  fireEvent.click(nvl); expect(onNext).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "返回当前对白"}));
  expect(document.querySelector(".abyssa-rp")).toHaveAttribute("data-mode", "play");
  expect(onNext).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "切换为 AVG 舞台"}));
  await waitFor(() => expect(screen.getByRole("button", {name: "下一句"})).toBeEnabled());
  expect(stage.typing).toBe(false);
  expect(stage.messages.at(-1)?.id).toBe("n1");
  expect(onNext).not.toHaveBeenCalled(); expect(onChoose).not.toHaveBeenCalled();
});

it("uses the shared choices in both layouts, hides them in LOG and retries a rejected save", async () => {
  const choose = vi.fn().mockRejectedValueOnce(Error("write failed")).mockResolvedValue(undefined), next = vi.fn();
  const props = {title: "回应", location: "洋馆", background: "/bg.webp", lines: [{id: "last", kind: "action" as const, text: "她等着答复。"}], cursor: 0,
    choice: {id: "attitude", prompt: "你的态度", options: [{id: "A" as const, label: "认真倾听"}, {id: "B" as const, label: "有所保留"}]}, onNext: next,  onChoose: choose};
  const wrap = (choice = props.choice) => <UiMotionProvider preference="reduced"><StoryReading {...props} choice={choice}/></UiMotionProvider>;
  const view = render(wrap());
  fireEvent.click(screen.getByRole("button", {name: "显示全文"}));
  expect(view.container.querySelector(".story-choices")).toHaveAttribute("data-placement", "overlay");
  expect(view.container.querySelectorAll(".story-choices__gem")).toHaveLength(2);
  expect(view.container.querySelector(".first-morning__choices")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "切换为 NVL 舞台"}));
  await waitFor(() => expect(screen.getByRole("button", {name: "认真倾听"})).toBeEnabled());
  expect(view.container.querySelector(".abyssa-rp__actions .story-choices")).toHaveAttribute("data-placement", "inline");
  fireEvent.click(screen.getByRole("button", {name: "回看已读对白"}));
  await waitFor(() => expect(view.container.querySelector(".story-choices")).toBeNull());
  expect(choose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "关闭回看"}));
  await waitFor(() => expect(screen.getByRole("button", {name: "有所保留"})).toBeEnabled());
  await act(async () => {fireEvent.click(screen.getByRole("button", {name: "有所保留"}));});
  expect(screen.getByRole("alert")).toHaveTextContent("选择未能提交");
  expect(screen.getByRole("button", {name: "有所保留"})).toBeEnabled();
  await act(async () => {fireEvent.click(screen.getByRole("button", {name: "有所保留"}));});
  expect(choose).toHaveBeenCalledTimes(2);
  expect(choose).toHaveBeenLastCalledWith("B");
  expect(next).not.toHaveBeenCalled();
  // The same prose endpoint can open a new task decision after its attitude.
  view.rerender(wrap({id: "decision", prompt: "是否接下", options: [{id: "A", label: "接下委托"}]}));
  await waitFor(() => expect(screen.getByRole("button", {name: "接下委托"})).toBeEnabled());
  expect(view.container.querySelectorAll(".story-choices[data-present=true]")).toHaveLength(1);
});
