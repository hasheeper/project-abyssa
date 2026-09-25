import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReadingPlayer, type ReadingPage } from "./ReadingPlayer";
import { ReadingTool } from "./ReadingTool";
import type { AdvStageProps } from "./AdvStage";

let stage: AdvStageProps;
const originalGetAnimations = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");
vi.mock("./AdvStage",()=>({AdvStage:(p:AdvStageProps)=>{stage=p;const last=p.messages.at(-1);return <div>{last?.kind === "narration" ? last.text : ""}</div>;}}));
beforeEach(()=>{
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype,"scrollTo",{configurable:true,value:vi.fn()});
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:vi.fn(()=>({cancel(){},finished:Promise.resolve()}))});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();
  if (originalGetAnimations) Object.defineProperty(Element.prototype,"getAnimations",originalGetAnimations);
  else Reflect.deleteProperty(Element.prototype,"getAnimations");
});
const tick=(ms:number)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});
const pages:ReadingPage[]=Array.from({length:4},(_,i)=>({id:`p${i}`,actors:[],messages:Array.from({length:i+1},(_,j)=>({id:`p${j}`,kind:"narration" as const,text:`正文${j}`}))}));
const finishTyping=()=>act(()=>stage.onTypingEnd?.());

it.each(["adv","nvl"] as const)("has the same five base controls and appended close action in %s",async initialLayout=>{
  const close=vi.fn();
  const view=render(<ReadingPlayer initialLayout={initialLayout} sceneId="s" title="阅读" location="洋馆" pages={pages.slice(0,1)} canAdvance onNext={vi.fn()}
    actions={<ReadingTool label="关闭场景" caption="CLOSE" glyph="close" onClick={close}/>}/>);
  const captions=()=>[...view.container.querySelectorAll(".rp-app__tools .rp-app__cell-label")].map(e=>e.textContent);
  expect(captions()).toEqual([initialLayout==="adv"?"NVL":"AVG","REPLAY","LOG","AUTO","SKIP","CLOSE"]);
  fireEvent.click(screen.getByRole("button",{name:initialLayout==="adv"?"切换为 NVL 舞台":"切换为 AVG 舞台"}));await tick(600);
  expect(captions().slice(1)).toEqual(["REPLAY","LOG","AUTO","SKIP","CLOSE"]);
  expect(screen.getByRole("button",{name:"上一幕"})).toBeDisabled();
  expect(screen.getByRole("button",{name:"下一幕"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"关闭场景"}));expect(close).toHaveBeenCalledOnce();
});

it("AUTO waits for typing and a committed cursor, never invokes the final confirmation",async()=>{
  let commit!:()=>void;
  const ordinary=vi.fn(()=>new Promise<void>(resolve=>{commit=resolve;})), confirm=vi.fn(),close=vi.fn();
  const draw=(cursor:number)=><ReadingPlayer sceneId="s" title="阅读" location="洋馆" pages={pages.slice(0,cursor+1)} canAdvance={cursor<2} onAdvance={ordinary} onNext={confirm} finalLabel="确认交付"
    actions={<ReadingTool label="关闭场景" caption="CLOSE" glyph="close" onClick={close}/>}/>;
  const view=render(draw(0));fireEvent.click(screen.getByRole("button",{name:"自动播放"}));
  await tick(5000);expect(ordinary).not.toHaveBeenCalled();
  finishTyping();await tick(2199);expect(ordinary).not.toHaveBeenCalled();await tick(1);expect(ordinary).toHaveBeenCalledOnce();
  expect(screen.getByRole("button",{name:"关闭场景"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"关闭场景"}));expect(close).not.toHaveBeenCalled();
  await tick(9000);expect(ordinary).toHaveBeenCalledOnce();
  await act(async()=>{commit();});view.rerender(draw(1));finishTyping();await tick(2200);expect(ordinary).toHaveBeenCalledTimes(2);
  await act(async()=>{commit();});view.rerender(draw(2));finishTyping();await tick(10000);
  expect(ordinary).toHaveBeenCalledTimes(2);expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"自动播放"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"确认交付"}));expect(confirm).toHaveBeenCalledOnce();
});

it("SKIP advances sequentially, reveals the last paragraph and stops before choosing or finishing",async()=>{
  const ordinary=vi.fn(),confirm=vi.fn(),choose=vi.fn();
  function Host(){const [cursor,setCursor]=useState(0);return <ReadingPlayer sceneId="s" title="阅读" location="洋馆" pages={pages.slice(0,cursor+1)} canAdvance={cursor<2}
    onAdvance={()=>{ordinary(cursor);setCursor(cursor+1);}} onNext={confirm}
    decision={cursor===2?{id:"decision",prompt:"你的态度",options:[{id:"A",label:"考虑一下"}]}:null} onChoose={choose}/>;}
  render(<Host/>);fireEvent.click(screen.getByRole("button",{name:"跳过本段对白"}));
  for(let i=0;i<5;i++)await tick(20);
  expect(ordinary.mock.calls).toEqual([[0],[1]]);expect(confirm).not.toHaveBeenCalled();expect(choose).not.toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"考虑一下"})).toBeEnabled();expect(screen.getByRole("button",{name:"跳过本段对白"})).toBeDisabled();
});

it.each(["reject","null"])("a failed reading write (%s) stops playback and allows an explicit retry",async kind=>{
  const advance=vi.fn();
  if(kind==="reject")advance.mockRejectedValueOnce(Error("写入失败"));else advance.mockResolvedValueOnce(null);
  advance.mockResolvedValue(undefined);
  render(<ReadingPlayer sceneId="s" title="阅读" location="洋馆" pages={pages.slice(0,1)} canAdvance onNext={advance}/>);
  fireEvent.click(screen.getByRole("button",{name:"跳过本段对白"}));await tick(30);
  expect(screen.getByText(kind==="reject"?"写入失败":"阅读进度未能保存，请重试。")).toBeInTheDocument();await tick(5000);expect(advance).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button",{name:"跳过本段对白"}));await tick(30);expect(advance).toHaveBeenCalledTimes(2);
});

it("NVL AUTO waits for the existing CSS reveal, then the same reading delay", async () => {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => {finish=resolve;});
  Object.defineProperty(Element.prototype,"getAnimations",{configurable:true,value:function(this:Element){return this.closest("[data-settled]") ? [] : [{finished}];}});
  const next=vi.fn(), draw=(cursor:number)=><ReadingPlayer initialLayout="nvl" sceneId="s" title="阅读" location="洋馆" pages={pages.slice(0,cursor+1)} canAdvance onNext={next}/>;
  const view=render(draw(0)); view.rerender(draw(1));
  fireEvent.click(screen.getByRole("button",{name:"自动播放"})); await tick(5000);
  expect(next).not.toHaveBeenCalled();
  await act(async()=>{finish();}); await tick(2199); expect(next).not.toHaveBeenCalled();
  await tick(1); expect(next).toHaveBeenCalledOnce();
});

it("NVL SKIP reveals the current final paragraph without confirming it", async () => {
  Object.defineProperty(Element.prototype,"getAnimations",{configurable:true,value:function(this:Element){return this.closest("[data-settled]") ? [] : [{finished:new Promise(()=>{})}];}});
  const next=vi.fn(), draw=(cursor:number)=><ReadingPlayer initialLayout="nvl" sceneId="s" title="阅读" location="洋馆" pages={pages.slice(0,cursor+1)} canAdvance={cursor===0} onNext={next}/>;
  const view=render(draw(0)); view.rerender(draw(1));
  expect(screen.getByRole("button",{name:"显示全文"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"跳过本段对白"})); await tick(5000);
  expect(view.container.querySelector(".abyssa-rp__message:last-child")).toHaveAttribute("data-settled","true");
  expect(screen.getByRole("button",{name:"跳过本段对白"})).toBeDisabled(); expect(next).not.toHaveBeenCalled();
});

it("replay and scene navigation use only presented prefixes without calling the host",async()=>{
  const advance=vi.fn();
  render(<ReadingPlayer sceneId="current" title="阅读" location="洋馆" pages={pages.slice(0,2)} canAdvance onNext={advance}
    history={[{id:"previous",title:"上一场",pages:[{id:"old",actors:[],messages:[{id:"old",kind:"narration",text:"上一场已读"}]}]}]}/>);
  fireEvent.click(screen.getByRole("button",{name:"从头重播"}));expect(stage.messages.at(-1)?.id).toBe("p0");
  expect(screen.getByRole("button",{name:"自动播放"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"重播下一句"}));expect(stage.messages.at(-1)?.id).toBe("p1");
  expect(screen.queryByText("正文2")).toBeNull();
  fireEvent.click(within(screen.getByRole("navigation",{name:"演出控制"})).getByRole("button",{name:"返回当前进度"}));
  fireEvent.click(screen.getByRole("button",{name:"上一幕"}));expect(screen.getByText("上一场已读")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"下一幕"}));expect(stage.messages.at(-1)?.id).toBe("p1");
  expect(advance).not.toHaveBeenCalled();
});

it.each(["LOG","blur","hidden","unmount"])("cancels AUTO on %s",async reason=>{
  const advance=vi.fn();const view=render(<ReadingPlayer sceneId="s" title="阅读" location="洋馆" pages={pages.slice(0,1)} canAdvance onNext={advance}/>);
  finishTyping();fireEvent.click(screen.getByRole("button",{name:"自动播放"}));await tick(1000);
  if(reason==="LOG")fireEvent.click(screen.getByRole("button",{name:"回看已读对白"}));
  if(reason==="blur")fireEvent(window,new Event("blur"));
  if(reason==="hidden"){vi.spyOn(document,"hidden","get").mockReturnValue(true);fireEvent(document,new Event("visibilitychange"));}
  if(reason==="unmount")view.unmount();
  await tick(5000);expect(advance).not.toHaveBeenCalled();
});
