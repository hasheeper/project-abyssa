import { useCallback, useMemo, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TutorialProvider, useTutorialAnchors, useTutorialStep, useTutorialSuspension } from "./TutorialProvider";

let resize: ()=>void;
const disconnect=vi.fn();
beforeEach(()=>{
  vi.stubGlobal("ResizeObserver",class {constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){disconnect();}});
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockImplementation(function(this:HTMLElement) {
    const shape=this.classList.contains("abyssa-tutorial") ? [0,0,1280,720] : this.classList.contains("abyssa-tutorial__card") ? [0,0,304,180] : this.dataset.testid === "enemy" ? [560,220,220,90] : [350,480,160,50];
    const [x,y,width,height]=shape;
    return {x,y,left:x,top:y,width,height,right:x+width,bottom:y+height,toJSON:()=>({})} as DOMRect;
  });
  vi.useFakeTimers();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

function Fixture({suspended=false, guided=false, stepId="test-roll", expandKey=0, onDismiss}:{suspended?:boolean; guided?:boolean; stepId?:string; expandKey?:number; onDismiss?:()=>void}) {
  const anchor=useTutorialAnchors(),[open,setOpen]=useState(true),[clicked,setClicked]=useState(0);
  const dismiss=useCallback(()=>{onDismiss?.();setOpen(false);},[onDismiss]);
  const step=useMemo(()=>open?{id:stepId,targets:["roll"],title:"掷出行动",text:"点击真正的骰子按钮。",onDismiss:dismiss,collapseOnDismiss:guided,expandKey}:null,[open,dismiss,stepId,guided,expandKey]);
  useTutorialStep(step);useTutorialSuspension(suspended);
  return <main data-testid="game"><button ref={anchor("roll")} title="原按钮说明" onClick={()=>setClicked(c=>c+1)}>ROLL</button><output>{clicked}</output></main>;
}

it("uses a single external portal without moving or duplicating controls; close never rolls",()=>{
  render(<TutorialProvider><Fixture/></TutorialProvider>);
  const roll=screen.getByRole("button",{name:"ROLL"});
  expect(document.querySelectorAll(".abyssa-tutorial")).toHaveLength(1);
  expect(document.querySelector(".abyssa-tutorial")?.parentElement).toBe(document.body);
  expect(screen.getByTestId("game").children).toHaveLength(2);
  expect(screen.getByRole("region",{name:"操作指引"})).toBeVisible();
  expect(roll).not.toHaveAttribute("title");
  fireEvent.click(roll);expect(screen.getByText("点击真正的骰子按钮。")).toBeVisible();
  expect(document.querySelector("output")).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button",{name:"关闭操作指引"}));
  expect(document.querySelector(".abyssa-tutorial")).toBeNull();
  expect(document.querySelector("output")).toHaveTextContent("1");
  expect(roll).toHaveAttribute("title","原按钮说明");
});

it("suspends through overlays, resumes after close, and cleans observers on unmount",async()=>{
  const {rerender,unmount}=render(<TutorialProvider><Fixture/></TutorialProvider>);
  rerender(<TutorialProvider><Fixture suspended/></TutorialProvider>);
  expect(screen.queryByRole("region",{name:"操作指引"})).toBeNull();
  rerender(<TutorialProvider><Fixture/></TutorialProvider>);
  expect(screen.getByRole("region",{name:"操作指引"})).toBeVisible();
  const modal=document.createElement("section");modal.setAttribute("aria-modal","true");
  await act(async()=>{document.body.append(modal);await vi.advanceTimersByTimeAsync(30);});
  expect(screen.queryByRole("region",{name:"操作指引"})).toBeNull();
  await act(async()=>{modal.remove();await vi.advanceTimersByTimeAsync(30);});
  expect(screen.getByRole("region",{name:"操作指引"})).toBeVisible();
  act(()=>resize());unmount();
  expect(disconnect).toHaveBeenCalled();expect(document.querySelector(".abyssa-tutorial")).toBeNull();
  await act(async()=>{await vi.runAllTimersAsync();});
});

it("nested scene providers share one canvas and respect both suspension scopes",()=>{
  const scene=(inner:boolean, outer=false)=><TutorialProvider suspended={outer}><TutorialProvider suspended={inner}><Fixture/></TutorialProvider></TutorialProvider>;
  const {rerender}=render(scene(false));
  expect(document.querySelectorAll(".abyssa-tutorial")).toHaveLength(1);
  rerender(scene(true));
  expect(screen.queryByRole("region",{name:"操作指引"})).toBeNull();
  rerender(scene(false,true));
  expect(screen.queryByRole("region",{name:"操作指引"})).toBeNull();
  rerender(scene(false));
  expect(screen.getByRole("region",{name:"操作指引"})).toBeVisible();
});

it("collapses guided copy locally, keeps its target, and restores without dismissing or acting",()=>{
  const dismiss=vi.fn();
  render(<TutorialProvider><Fixture guided onDismiss={dismiss}/></TutorialProvider>);
  const roll=screen.getByRole("button",{name:"ROLL"});
  fireEvent.click(screen.getByRole("button",{name:"收起操作指引"}));
  expect(dismiss).not.toHaveBeenCalled();
  expect(document.querySelector("output")).toHaveTextContent("0");
  expect(screen.getByRole("button",{name:"ROLL"})).toBe(roll);
  expect(document.querySelector(".abyssa-tutorial")).toHaveAttribute("data-collapsed","true");
  expect(document.querySelectorAll(".abyssa-tutorial__outline")).toHaveLength(1);
  expect(document.querySelector(".abyssa-tutorial__canvas > rect")).toBeNull();
  expect(screen.getByText("点击真正的骰子按钮。")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"展开操作指引"}));
  expect(screen.getByText("点击真正的骰子按钮。")).toBeVisible();
  expect(document.querySelector(".abyssa-tutorial")).not.toHaveAttribute("data-collapsed");
  expect(dismiss).not.toHaveBeenCalled();
});

it("automatically expands a new guided step and honors a menu reopen of the same step",()=>{
  const {rerender}=render(<TutorialProvider><Fixture guided/></TutorialProvider>);
  fireEvent.click(screen.getByRole("button",{name:"收起操作指引"}));
  rerender(<TutorialProvider><Fixture guided stepId="next-step"/></TutorialProvider>);
  expect(screen.getByText("点击真正的骰子按钮。")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"收起操作指引"}));
  rerender(<TutorialProvider><Fixture guided stepId="next-step" expandKey={1}/></TutorialProvider>);
  expect(screen.getByText("点击真正的骰子按钮。")).toBeVisible();
  expect(document.querySelector("output")).toHaveTextContent("0");
});

function ContextFixture({missing=false, observe=false, onRead=()=>{}}:{missing?:boolean;observe?:boolean;onRead?:()=>void}) {
  const anchor=useTutorialAnchors();
  const step=useMemo(()=>({id:"bow-threat",targets:[observe ? "enemy" : "roll"],contextTargets:observe ? ["roll"] : ["enemy"],
    title:"拦下弩箭",text:"弩手已经瞄准尤斯缇丝。",collapseOnDismiss:true,onDismiss:()=>{},
    action:observe ? {label:"准备应对",onSelect:onRead} : undefined}),[observe,onRead]);
  useTutorialStep(step);
  return <><button ref={anchor("roll")}>ROLL</button>{!missing && <section ref={anchor("enemy")} data-testid="enemy">弩手 · 攻击 2</section>}</>;
}

it("lights both the actionable control and its threat context without giving context action semantics",()=>{
  render(<TutorialProvider><ContextFixture/></TutorialProvider>);
  const root=document.querySelector(".abyssa-tutorial")!;
  expect(root).toHaveAttribute("data-visible","true");
  expect(root.querySelectorAll(".abyssa-tutorial__outline")).toHaveLength(1);
  expect(root.querySelectorAll(".abyssa-tutorial__context")).toHaveLength(1);
  expect(root.querySelector(".abyssa-tutorial__context")).toHaveAttribute("data-context-target","enemy");
  expect(root.querySelectorAll('mask rect[fill="black"]')).toHaveLength(2);
  expect(screen.getByRole("button",{name:"ROLL"})).toHaveAttribute("aria-describedby",expect.stringContaining("tutorial-copy-"));
  expect(screen.getByTestId("enemy")).not.toHaveAttribute("aria-describedby");
  const card=root.querySelector<HTMLElement>(".abyssa-tutorial__card")!;
  const x=parseFloat(card.style.left), y=parseFloat(card.style.top);
  expect(x+304<=554 || x>=786 || y+180<=214 || y>=316).toBe(true);
});

it("keeps the main instruction visible when an optional context anchor is absent",()=>{
  render(<TutorialProvider><ContextFixture missing/></TutorialProvider>);
  expect(document.querySelector(".abyssa-tutorial")).toHaveAttribute("data-visible","true");
  expect(document.querySelectorAll(".abyssa-tutorial__context")).toHaveLength(0);
  expect(screen.getByRole("region",{name:"操作指引"})).toBeVisible();
});

it("collapses and restores orientation without acknowledging it or moving the action",()=>{
  const read=vi.fn();
  render(<TutorialProvider><ContextFixture observe onRead={read}/></TutorialProvider>);
  const root=document.querySelector(".abyssa-tutorial")!;
  expect(root).toHaveAttribute("data-observation","true");
  fireEvent.click(screen.getByRole("button",{name:"收起操作指引"}));
  expect(read).not.toHaveBeenCalled();
  expect(root).toHaveAttribute("data-collapsed","true");
  fireEvent.click(screen.getByRole("button",{name:"展开操作指引"}));
  expect(read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:/准备应对/}));
  expect(read).toHaveBeenCalledOnce();
});
