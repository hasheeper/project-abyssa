import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import type { AuthoredLine } from "../../content/presentation/authored-story";
import { PlayerIdentityProvider } from "../../shared/domain/PlayerIdentity";
import { ReadingTool } from "../../shared/presentation/adv/ReadingTool";
import { SCENE_SEQUENCE_MS } from "../../shared/presentation/adv/SceneSequence";
import { AirpReading, airpVisibleLines } from "./AirpReading";
import { prepareImages } from "../../shared/loading/images";
import { FlowReaderEntrance } from "./FlowReaderEntrance";

vi.mock("../../shared/loading/images", () => ({ prepareImages: vi.fn().mockResolvedValue(undefined) }));
beforeEach(() => {
  vi.mocked(prepareImages).mockResolvedValue(undefined);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {configurable: true, value: vi.fn()});
  Object.defineProperty(HTMLElement.prototype, "animate", {configurable: true, value: vi.fn(() => ({cancel() {}, finished: Promise.resolve()}))});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const lines: AuthoredLine[] = [
  { id: "opening", kind: "action", text: "艾洛拉从窗边转过身。", actors: [{ characterId: "kael", emotion: "neutral" }] },
  { id: "npc", characterId: "elora", expression: "b", text: "怎么现在才来？" },
  { id: "player", characterId: "kael", text: "刚才在门口。", actors: [{ characterId: "kael", emotion: "serious", motion: "nod" }] },
];

it("prepares the actual reader under the room expansion without consuming its first line", async () => {
  vi.useFakeTimers();
  let ready!:()=>void;
  vi.mocked(prepareImages).mockReturnValue(new Promise<void>(resolve=>{ready=resolve;}));
  const prepared=vi.fn(),next=vi.fn();
  const frame=(blocked:boolean)=><FlowReaderEntrance blocked={blocked} onPrepared={prepared}>
    <AirpReading embedded wide sceneId="handoff" title="展开阅读" location="洋馆" background="/same-room.webp" lines={lines} cursor={1} onNext={next}/>
  </FlowReaderEntrance>;
  const {container,rerender}=render(frame(true));
  const sequence=container.querySelector(".scene-sequence")!,actor=container.querySelector('[data-character="elora"]');
  const background=container.querySelector(".rp-adv__bg");
  await advance(900);
  expect(prepared).not.toHaveBeenCalled();
  expect(sequence).toHaveAttribute("data-phase","prepare");
  expect(container.querySelector(".rp-adv__dialogue")).toBeNull();
  await act(async()=>ready());
  expect(prepared).toHaveBeenCalled();
  expect(sequence).toHaveAttribute("data-phase","prepare");
  rerender(frame(false));await advance(0);
  expect(sequence).toHaveAttribute("data-phase","in");
  expect(sequence).toHaveAttribute("data-adv-entrance","dissolve");
  expect(container.querySelector(".rp-adv__bg")).toBe(background);
  expect(container.querySelector('[data-character="elora"]')).toBe(actor);
  expect(container.querySelector(".rp-adv__dialogue")).toBeInTheDocument();
  expect(container.querySelector(".scene-sequence__frame")).toHaveAttribute("inert");
  await advance(SCENE_SEQUENCE_MS.advDissolve);
  expect(sequence).toHaveAttribute("data-phase","idle");
  expect(next).not.toHaveBeenCalled();
});

it("hides a redundant narration role label without editing prose or saved lines", () => {
  const source: AuthoredLine[] = [{id: "n", kind: "action", text: "narrator：她收起绷带。\n旁白：窗外安静下来。"}, {id: "d", characterId: "elora", text: "「旁白：」是什么？"}];
  expect(airpVisibleLines(source).map(l => l.text)).toEqual(["她收起绷带。\n窗外安静下来。", source[1].text]);
  expect(source[0].text).toContain("narrator：");
});

it("shows only read historical lines, keeps POV offstage, and returns without sending commands", async () => {
  vi.useFakeTimers();
  vi.mocked(prepareImages).mockClear();
  const next = vi.fn(), choose = vi.fn();
  const {container} = render(<AirpReading sceneId="live" title="当前场景" location="洋馆" background="/bg.webp"
    lines={[{id:"live:0",kind:"action",text:"当前的场景。"}]} cursor={0} onNext={next} onChoose={choose}
    previousScenes={[{id:"past",title:"已读场景",background:"/past-room.webp",lines:[...lines,{id:"unread",kind:"action",text:"还没读过的历史尾句。"}],readCount:3,response:"保持谨慎"}]}/>);
  await advance(0); await advance(SCENE_SEQUENCE_MS.advIn);
  const prepared = vi.mocked(prepareImages).mock.calls.flatMap(call => call[0]);
  expect(prepared).toContain("/bg.webp");
  expect(prepared).not.toContain("/past-room.webp");
  fireEvent.click(screen.getByRole("button", {name:"上一幕"}));
  expect(container.querySelector("main")).toHaveAttribute("data-replaying", "true");
  expect(container.querySelector(".rp-adv__bg")).toHaveStyle({backgroundImage: "url(/past-room.webp)"});
  expect(container.querySelector('[data-character="kael"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"回看已读对白"})); await advance(600);
  const log = screen.getByLabelText("NVL 消息流");
  expect(log.querySelector(".abyssa-rp__bg")).toHaveStyle({backgroundImage: "url(/past-room.webp)"});
  expect(log).toHaveTextContent("保持谨慎"); expect(log).toHaveTextContent("刚才在门口。");
  expect(log).not.toHaveTextContent("还没读过的历史尾句。");
  expect(container.querySelector('[data-character="kael"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"关闭回看"})); await advance(600);
  fireEvent.click(screen.getByRole("button", {name:"下一幕"}));
  expect(container.querySelector("main")).not.toHaveAttribute("data-replaying");
  expect(container.querySelector(".rp-adv__bg")).toHaveStyle({backgroundImage: "url(/bg.webp)"});
  expect(next).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
});

it("uses the shared entrance once, keeps POV offstage on narration and speech, and preserves NPC expression", async () => {
  vi.useFakeTimers();
  const onNext = vi.fn(), onClose = vi.fn(), onChoose = vi.fn();
  const frame = (cursor: number) => <StrictMode><PlayerIdentityProvider name="林恩"><AirpReading
    sceneId="test-scene" wide title="测试交谈" location="MANSION" background="/test-bg.webp"
    lines={lines} cursor={cursor} onNext={onNext} onChoose={onChoose}
    controls={<ReadingTool label="关闭当前场景（保留进度）" caption="CLOSE" glyph="close" onClick={onClose}/>}
    feedback={<span role="status">测试反馈</span>}
  /></PlayerIdentityProvider></StrictMode>;
  const { container, rerender } = render(frame(0));
  const sequence = container.querySelector(".scene-sequence")!;
  expect(container.querySelectorAll(".abyssa-stage")).toHaveLength(1);
  expect(sequence.parentElement).toHaveClass("abyssa-stage__canvas");
  expect(sequence).toHaveAttribute("data-phase", "prepare");
  const close = screen.getByRole("button", { name: "关闭当前场景（保留进度）" });
  expect(close).toBeDisabled();
  fireEvent.click(close);
  expect(onClose).not.toHaveBeenCalled();
  expect(container.querySelector('[data-character="kael"]')).toBeNull();
  const npc = container.querySelector('[data-character="elora"]');
  expect(npc).toHaveAttribute("data-settled");
  expect(npc).toHaveAttribute("data-expression", "b");
  await advance(0);
  expect(sequence).toHaveAttribute("data-phase", "in");
  expect(close).toBeDisabled();
  await advance(SCENE_SEQUENCE_MS.advIn);
  expect(sequence).toHaveAttribute("data-phase", "idle");
  expect(close).toBeEnabled();

  rerender(frame(1));
  expect(container.querySelector(".scene-sequence")).toBe(sequence);
  expect(sequence).toHaveAttribute("data-phase", "idle");
  expect(container.querySelector('[data-character="elora"]')).toBe(npc);
  expect(npc).toHaveAttribute("data-active", "true");
  rerender(frame(2));
  expect(sequence).toHaveAttribute("data-phase", "idle");
  expect(container.querySelector('[data-character="kael"]')).toBeNull();
  expect(container.querySelector('[data-character="elora"]')).toBe(npc);
  expect(screen.getByText("林恩")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "显示全文" }));
  expect(container.querySelector(".rp-adv__dialogue")).toHaveTextContent("刚才在门口。");
  expect(onNext).not.toHaveBeenCalled();

  expect(close).toHaveClass("rp-app__cell", "rp-app__tool");
  expect(close.querySelector("svg")).toBeInTheDocument();
  expect(container.querySelector(".rp-app__bar .story-reading__feedback")).toBeNull();
  expect(screen.getByRole("status").closest(".story-reading__feedback")).not.toBeNull();
  fireEvent.click(close);
  expect(onClose).toHaveBeenCalledOnce();
  expect(onNext).not.toHaveBeenCalled();
  expect(onChoose).not.toHaveBeenCalled();
});

it("keeps AIRP POV, the same scene and custom controls across AVG/NVL and LOG", async () => {
  vi.useFakeTimers();
  const next = vi.fn(), close = vi.fn();
  const {container} = render(<PlayerIdentityProvider name="林恩"><AirpReading sceneId="modes" wide title="当前场景" location="洋馆"
    background="/bg.webp" lines={lines} cursor={2} onNext={next}
    controls={<ReadingTool glyph="close" caption="CLOSE" label="关闭当前场景" onClick={close}/>}/></PlayerIdentityProvider>);
  await advance(0); await advance(SCENE_SEQUENCE_MS.advIn);
  const sequence = container.querySelector(".scene-sequence");
  fireEvent.click(screen.getByRole("button", {name: "切换为 NVL 舞台"}));
  await advance(600);
  expect(screen.getByLabelText("NVL 消息流")).toHaveTextContent("刚才在门口。");
  expect(container.querySelector('[data-character="kael"]')).toBeNull();
  expect(container.querySelector('[data-character="elora"]')).toBeInTheDocument();
  expect(container.querySelector(".scene-sequence")).toBe(sequence);
  expect(sequence).toHaveAttribute("data-phase", "idle");
  fireEvent.click(screen.getByRole("button", {name: "回看已读对白"}));
  expect(container.querySelector(".abyssa-rp")).toHaveAttribute("data-mode", "log");
  fireEvent.click(screen.getByRole("button", {name: "关闭回看"}));
  fireEvent.click(screen.getByRole("button", {name: "切换为 AVG 舞台"}));
  await advance(600);
  expect(screen.getByLabelText("AVG 对话")).toBeInTheDocument();
  expect(container.querySelector('[data-character="kael"]')).toBeNull();
  expect(container.querySelector(".scene-sequence")).toBe(sequence);
  expect(next).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "关闭当前场景"}));
  expect(close).toHaveBeenCalledOnce();
});
