import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { AdvStage } from "./AdvStage";
import { SceneSequence, SCENE_SEQUENCE_MS as ms, useSceneSequenceBusy } from "./SceneSequence";
import { UiMotionProvider } from "../../ui/motion/UiMotionProvider";
import * as images from "../../loading/images";
const advance = async (time:number) => act(async () => {await vi.advanceTimersByTimeAsync(time);});
const settleBoard = (container: HTMLElement, animationName = "test-board-settle") =>
  fireEvent(container.querySelector("[data-scene-settle]")!, Object.assign(new Event("animationend", {bubbles: true}), {animationName}));
afterEach(() => {cleanup(); vi.useRealTimers(); vi.restoreAllMocks();});
it("reuses the bounded preparation when the expanding room releases a dissolve entrance", async () => {
  vi.useFakeTimers();
  vi.spyOn(images, "prepareImages").mockImplementation(() => new Promise<void>(() => {}));
  const onPrepared = vi.fn();
  const frame = {id:"room",kind:"adv" as const,assets:["slow-room.webp"],content:<p>已准备的对白</p>};
  const {container,rerender} = render(<StrictMode><SceneSequence frame={frame} advEntrance="dissolve" openingBlocked onPrepared={onPrepared}/></StrictMode>);
  await advance(0); await advance(3000);
  expect(onPrepared).toHaveBeenCalledOnce();
  expect(container.firstChild).toHaveAttribute("data-phase", "prepare");
  const preparationCalls = vi.mocked(images.prepareImages).mock.calls.length;
  rerender(<StrictMode><SceneSequence frame={frame} advEntrance="dissolve" onPrepared={onPrepared}/></StrictMode>);
  await advance(0);
  expect(container.firstChild).toHaveAttribute("data-phase", "in");
  expect(images.prepareImages).toHaveBeenCalledTimes(preparationCalls);
  await advance(ms.advDissolve);
  expect(container.firstChild).toHaveAttribute("data-phase", "idle");
});

it("covers in-place ADV scenery before swapping its line, holds black, then unlocks without remounting", async () => {
  vi.useFakeTimers();
  const next = vi.fn();
  function Reading({text}: {text:string}) {
    return <button disabled={useSceneSequenceBusy()} onClick={next}>{text}</button>;
  }
  const frame = (backdrop:string, text:string) => ({id:"story",kind:"adv" as const,backdrop,content:<Reading text={text}/>});
  const {container,rerender} = render(<StrictMode><SceneSequence frame={frame("shore","洞口第一句")}/></StrictMode>);
  await advance(0); await advance(ms.advIn);
  const reading = screen.getByRole("button");
  rerender(<StrictMode><SceneSequence frame={frame("shore","洞口第二句")}/></StrictMode>);
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
  expect(container.querySelector(".scene-sequence__curtain")).toBeNull();
  expect(reading).toHaveTextContent("洞口第二句");

  rerender(<StrictMode><SceneSequence frame={frame("grotto","越过洞口")}/></StrictMode>);
  expect(container.firstChild).toHaveAttribute("data-phase","cover");
  expect(reading).toHaveTextContent("洞口第二句");
  expect(reading).toBeDisabled();
  fireEvent.click(reading);
  expect(next).not.toHaveBeenCalled();
  await advance(ms.cover - 1);
  expect(reading).toHaveTextContent("洞口第二句");
  await advance(1);
  expect(container.firstChild).toHaveAttribute("data-phase","covered");
  expect(reading).toHaveTextContent("越过洞口");
  expect(screen.getByRole("button")).toBe(reading);
  expect(container.querySelector(".scene-sequence__frame")).toHaveAttribute("inert");
  await advance(ms.covered - 1);
  expect(container.firstChild).toHaveAttribute("data-phase","covered");
  await advance(1);
  expect(container.firstChild).toHaveAttribute("data-phase","uncover");
  expect(reading).toBeDisabled();
  await advance(ms.uncover);
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
  expect(container.querySelector(".scene-sequence__curtain")).toBeNull();
  fireEvent.click(reading);
  expect(next).toHaveBeenCalledOnce();
});

it("restores the current backdrop directly and finishes a curtain when reduced motion is enabled mid-transition", async () => {
  vi.useFakeTimers();
  const frame = (backdrop:string) => ({id:"story",kind:"adv" as const,backdrop,content:<p>{backdrop}</p>});
  const {container,rerender,unmount} = render(<UiMotionProvider preference="system"><SceneSequence frame={frame("grotto")}/></UiMotionProvider>);
  expect(screen.getByText("grotto")).toBeInTheDocument();
  expect(container.querySelector(".scene-sequence__curtain")).toBeNull();
  await advance(0); await advance(ms.advIn);
  rerender(<UiMotionProvider preference="system"><SceneSequence frame={frame("shore")}/></UiMotionProvider>);
  expect(container.firstChild).toHaveAttribute("data-phase","cover");
  rerender(<UiMotionProvider preference="reduced"><SceneSequence frame={frame("shore")}/></UiMotionProvider>);
  await advance(10);
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
  expect(screen.getByText("shore")).toBeInTheDocument();
  expect(container.querySelector(".scene-sequence__curtain")).toBeNull();
  unmount();
  await advance(5000);
});

it("also covers a new ADV section when its location changes, including the return home", async () => {
  vi.useFakeTimers();
  const {container,rerender} = render(<SceneSequence frame={{id:"S3-5",kind:"adv",backdrop:"shore",content:<p>穿出洞口</p>}}/>);
  await advance(0); await advance(ms.advIn);
  rerender(<SceneSequence frame={{id:"S4-1",kind:"adv",backdrop:"home",content:<p>回到洋馆</p>}}/>);
  expect(container.firstChild).toHaveAttribute("data-phase","cover");
  expect(screen.queryByText("回到洋馆")).toBeNull();
  await advance(ms.cover);
  expect(container.firstChild).toHaveAttribute("data-phase","covered");
  expect(screen.queryByText("穿出洞口")).toBeNull();
  expect(screen.getByText("回到洋馆")).toBeInTheDocument();
  await advance(ms.covered); await advance(ms.uncover);
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
});

it("releases a scenery curtain when the tab becomes hidden", async () => {
  vi.useFakeTimers();
  const frame = (backdrop:string) => ({id:"story",kind:"adv" as const,backdrop,content:<p>{backdrop}</p>});
  const {container,rerender} = render(<SceneSequence frame={frame("cargo")}/>);
  await advance(0); await advance(ms.advIn);
  rerender(<SceneSequence frame={frame("grotto")}/>);
  expect(container.firstChild).toHaveAttribute("data-phase","cover");
  vi.spyOn(document,"hidden","get").mockReturnValue(true);
  await act(async () => {document.dispatchEvent(new Event("visibilitychange"));});
  await advance(10);
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
  expect(screen.getByText("grotto")).toBeInTheDocument();
  expect(container.querySelector(".scene-sequence__curtain")).toBeNull();
});

it("freezes the outgoing frame, finishes battle exit before mounting ADV, then returns downward", async () => {
  vi.useFakeTimers();
  const {rerender,container} = render(<SceneSequence frame={{id:"battle",kind:"battle",content:<p>最后一击</p>}}/>);
  rerender(<SceneSequence frame={{id:"story",kind:"adv",content:<p>第一句</p>}}/>);
  expect(container.firstChild).toHaveAttribute("data-phase","out");
  expect(screen.getByText("最后一击")).toBeInTheDocument();
  expect(screen.queryByText("第一句")).toBeNull();
  expect(container.querySelector(".scene-sequence__frame")).toHaveAttribute("inert");
  await advance(ms.battleOut);
  expect(screen.queryByText("最后一击")).toBeNull();
  expect(screen.getByText("第一句")).toBeInTheDocument();
  expect(container.firstChild).toHaveAttribute("data-phase","in");
  await advance(ms.advIn);
  rerender(<SceneSequence frame={{id:"story",kind:"adv",content:<p>最后一句</p>}}/>);
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
  rerender(<SceneSequence frame={{id:"battle",kind:"battle",content:<p>准备战斗</p>}}/>);
  expect(screen.getByText("最后一句")).toBeInTheDocument();
  expect(screen.queryByText("准备战斗")).toBeNull();
  await advance(ms.advOut);
  expect(container.firstChild).toHaveAttribute("data-scene","battle");
  expect(container.firstChild).toHaveAttribute("data-phase","in");
  await advance(ms.battleIn);
  expect(container.firstChild).toHaveAttribute("aria-busy","false");
});
it("waits for the combat presentation queue, and hiding the tab releases both phases", async () => {
  vi.useFakeTimers();
  const battle = {id:"battle",kind:"battle" as const,content:<p>伤害结算</p>};
  const story = {id:"story",kind:"adv" as const,content:<p>战后对话</p>};
  const {rerender,container} = render(<SceneSequence frame={battle}/>);
  rerender(<SceneSequence frame={story} blocked/>);
  await advance(5000);
  expect(screen.getByText("伤害结算")).toBeInTheDocument();
  rerender(<SceneSequence frame={story}/>);
  vi.spyOn(document,"hidden","get").mockReturnValue(true);
  await act(async () => {document.dispatchEvent(new Event("visibilitychange"));});
  await advance(1);
  expect(screen.getByText("战后对话")).toBeInTheDocument();
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
});

it("establishes the background and shared arrival title before mounting the dialogue, after the document curtain", async () => {
  vi.useFakeTimers();
  const frame = {id:"morning",kind:"adv" as const,arrival:{background:"arrival-test.webp",eyebrow:"序章 · 守望者之崖",title:"洋馆的第一个清晨"},content:<p>第一句</p>};
  const {container,rerender}=render(<SceneSequence frame={frame} openingBlocked/>);
  await advance(5000);
  expect(container.firstChild).toHaveAttribute("data-phase","prepare");
  expect(screen.queryByText("第一句")).toBeNull();
  rerender(<SceneSequence frame={frame}/>);
  await advance(3001);
  expect(container.firstChild).toHaveAttribute("data-phase","arrival");
  expect(container.querySelector(".scene-arrival__title")).toHaveTextContent("洋馆的第一个清晨");
  expect(screen.queryByText("第一句")).toBeNull();
  await advance(ms.arrival);
  expect(container.firstChild).toHaveAttribute("data-phase","in");
  expect(screen.getByText("第一句")).toBeInTheDocument();
  await advance(ms.advIn);
  expect(container.querySelector(".scene-sequence__arrival")).toBeNull();
  rerender(<SceneSequence frame={{...frame,content:<p>破窗与落地</p>}}/>);
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
  expect(screen.getByText("破窗与落地")).toBeInTheDocument();
});

it("keeps the scene's initial actor settled after its entrance, but permits later re-entry", async () => {
  vi.useFakeTimers();
  const actors=[{id:"abyssa",name:"艾比希斯",portrait:"abyssa.png"},{id:"elora",name:"艾洛拉",portrait:"elora.png"}];
  const frame=(id:string)=>({id:"morning",kind:"adv" as const,content:<AdvStage actors={actors} initialSlots={{left:id}} messages={[]} typing={false}/>});
  const {container,rerender}=render(<StrictMode><SceneSequence frame={frame("abyssa")}/></StrictMode>);
  const first=container.querySelector('[data-character="abyssa"]')!;
  expect(first).toHaveAttribute("data-settled");
  await advance(0);
  expect(container.firstChild).toHaveAttribute("data-phase","in");
  await advance(ms.advIn);
  expect(container.querySelector('[data-character="abyssa"]')).toBe(first);
  expect(first).toHaveAttribute("data-settled");
  rerender(<StrictMode><SceneSequence frame={frame("elora")}/></StrictMode>);
  expect(container.querySelector('[data-character="elora"]')).not.toHaveAttribute("data-settled");
  await advance(450);
  rerender(<StrictMode><SceneSequence frame={frame("abyssa")}/></StrictMode>);
  expect(container.querySelector('[data-character="abyssa"][data-phase="enter"]')).not.toHaveAttribute("data-settled");
});

it("uses the same board entrance on first mount, refresh and ADV return, never on combat updates", async () => {
  vi.useFakeTimers();
  const frame = {id:"battle", kind:"battle" as const, battleMotion:"board" as const, content:<p data-scene-settle="test-board-settle">正确敌阵</p>};
  const mounted = render(<StrictMode><SceneSequence frame={frame} openingBlocked/></StrictMode>);
  await advance(2000);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "prepare");
  mounted.rerender(<StrictMode><SceneSequence frame={frame}/></StrictMode>);
  await advance(0);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "prepare");
  await advance(40);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "in");
  expect(mounted.container.firstChild).toHaveAttribute("data-battle-motion", "board");
  await advance(ms.boardIn - 1);
  expect(mounted.container.querySelector(".scene-sequence__frame")).toHaveAttribute("inert");
  await advance(1);
  // A mount-time deadline may run before the browser has shown the final frame.
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "in");
  settleBoard(mounted.container, "short-opacity-track");
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "in");
  settleBoard(mounted.container);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "idle");
  mounted.rerender(<StrictMode><SceneSequence frame={{...frame,content:<p>生命更新</p>}}/></StrictMode>);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "idle");
  mounted.rerender(<StrictMode><SceneSequence frame={{id:"story",kind:"adv",content:<p>剧情</p>}}/></StrictMode>);
  await advance(ms.battleOut); await advance(ms.advIn);
  mounted.rerender(<StrictMode><SceneSequence frame={frame}/></StrictMode>);
  await advance(ms.advOut);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "prepare");
  await advance(40);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "in");
  await advance(ms.boardIn);
  settleBoard(mounted.container);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase", "idle");
  mounted.unmount();
  const refreshed = render(<SceneSequence frame={frame}/>);
  await advance(40);
  expect(refreshed.container.firstChild).toHaveAttribute("data-phase", "in");
  await advance(ms.boardIn);
  settleBoard(refreshed.container);
  expect(refreshed.container.firstChild).toHaveAttribute("data-phase", "idle");
});

it("settles a board on reduced motion or tab hiding without replaying when restored", async () => {
  vi.useFakeTimers();
  const frame={id:"battle",kind:"battle" as const,battleMotion:"board" as const,content:<p>准备战斗</p>};
  const mounted=render(<UiMotionProvider preference="system"><SceneSequence frame={frame}/></UiMotionProvider>);
  await advance(0);
  mounted.rerender(<UiMotionProvider preference="reduced"><SceneSequence frame={frame}/></UiMotionProvider>);
  await advance(0);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase","idle");
  mounted.rerender(<UiMotionProvider preference="system"><SceneSequence frame={frame}/></UiMotionProvider>);
  expect(mounted.container.firstChild).toHaveAttribute("data-phase","idle");
  mounted.unmount();
  const hidden=render(<SceneSequence frame={frame}/>); await advance(40);
  vi.spyOn(document,"hidden","get").mockReturnValue(true);
  await act(async () => {document.dispatchEvent(new Event("visibilitychange"));});
  expect(hidden.container.firstChild).toHaveAttribute("data-phase","idle");
});

it("cancels board paint callbacks on unmount and releases a missing animation through the failsafe", async () => {
  vi.useFakeTimers();
  const frame={id:"battle",kind:"battle" as const,battleMotion:"board" as const,content:<p>准备战斗</p>};
  const pending=render(<SceneSequence frame={frame}/>);
  await advance(0);
  pending.unmount();
  await advance(40);
  const fallback=render(<SceneSequence frame={frame}/>);
  await advance(40);
  await advance(ms.boardIn);
  expect(fallback.container.firstChild).toHaveAttribute("data-phase","in");
  await advance(ms.boardIn * 2);
  expect(fallback.container.firstChild).toHaveAttribute("data-phase","idle");
});

it("waits for every entrance participant, including the last staggered die, without counting duplicates", async () => {
  vi.useFakeTimers();
  const frame={id:"battle",kind:"battle" as const,battleMotion:"board" as const,content:<>
    <div data-scene-settle="board">木板</div>
    <div data-scene-settle="land">首骰</div><div data-scene-settle="land">末骰</div>
    <div data-scene-settle="speech">对白</div>
  </>};
  const {container,rerender}=render(<SceneSequence frame={frame}/>);
  await advance(40);
  const end = (text:string, animationName:string) => fireEvent(screen.getByText(text), Object.assign(new Event("animationend", {bubbles:true}), {animationName}));
  end("木板","board"); end("首骰","land"); end("首骰","land"); end("末骰","opacity"); end("对白","speech");
  expect(container.firstChild).toHaveAttribute("data-phase","in");
  expect(container.querySelector(".scene-sequence__frame")).toHaveAttribute("inert");
  rerender(<SceneSequence frame={{...frame}}/>);
  end("末骰","land");
  expect(container.firstChild).toHaveAttribute("data-phase","idle");
  expect(container.querySelector(".scene-sequence__frame")).not.toHaveAttribute("inert");
});
