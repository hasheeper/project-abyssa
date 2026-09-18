import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { useBattleMotionPolicy } from "./useBattleMotionPolicy";
import { AnimatedPartyLink } from "./ExpeditionBattleChrome";

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function Subject({blocked=false,busy=false}:{blocked?:boolean;busy?:boolean}) {
  const policy=useBattleMotionPolicy({blocked,foregroundBusy:busy});
  return <div data-paused={policy.ambientPaused} data-links={policy.linksPaused} data-throttled={policy.fogThrottled}>
    <AnimatedPartyLink active paused={policy.linksPaused}/>
  </div>;
}
it("freezes ambient for blockers, visibility and live preferences; foreground only throttles fog",()=>{
  let systemReduced=false;
  const listeners=new Set<()=>void>();
  vi.stubGlobal("matchMedia",()=>({get matches(){return systemReduced;},addEventListener:(_name:string,fn:()=>void)=>listeners.add(fn),removeEventListener:(_name:string,fn:()=>void)=>listeners.delete(fn)}));
  const frames=new Map<number,FrameRequestCallback>();let id=0;
  vi.stubGlobal("requestAnimationFrame",(cb:FrameRequestCallback)=>{frames.set(++id,cb);return id;});
  vi.stubGlobal("cancelAnimationFrame",(key:number)=>frames.delete(key));
  const {container,rerender,unmount}=render(<UiMotionProvider><Subject/></UiMotionProvider>);
  const root=container.firstChild!;
  expect(root).toHaveAttribute("data-paused","false");expect(frames.size).toBe(1);
  rerender(<UiMotionProvider><Subject busy/></UiMotionProvider>);
  expect(root).toHaveAttribute("data-paused","false");
  expect(root).toHaveAttribute("data-throttled","true");expect(frames.size).toBe(0);
  rerender(<UiMotionProvider><Subject blocked/></UiMotionProvider>);
  expect(root).toHaveAttribute("data-paused","true");expect(frames.size).toBe(0);
  rerender(<UiMotionProvider><Subject/></UiMotionProvider>);
  const hidden=vi.spyOn(document,"hidden","get").mockReturnValue(true);
  fireEvent(document,new Event("visibilitychange"));
  expect(root).toHaveAttribute("data-paused","true");expect(frames.size).toBe(0);
  hidden.mockReturnValue(false);
  fireEvent(document,new Event("visibilitychange"));expect(frames.size).toBe(1);
  rerender(<UiMotionProvider preference="reduced"><Subject/></UiMotionProvider>);
  expect(root).toHaveAttribute("data-paused","true");expect(frames.size).toBe(0);
  rerender(<UiMotionProvider><Subject/></UiMotionProvider>);
  act(()=>{systemReduced=true;listeners.forEach(fn=>fn());});
  expect(root).toHaveAttribute("data-paused","true");expect(frames.size).toBe(0);
  act(()=>{systemReduced=false;listeners.forEach(fn=>fn());});expect(frames.size).toBe(1);
  unmount();expect(frames.size).toBe(0);expect(listeners.size).toBe(0);
});

it("keeps a party link's shape and phase on pause/resume, and releases its RAF",()=>{
  const frames=new Map<number,FrameRequestCallback>();let id=0;
  vi.stubGlobal("requestAnimationFrame",(cb:FrameRequestCallback)=>{frames.set(++id,cb);return id;});
  vi.stubGlobal("cancelAnimationFrame",(key:number)=>frames.delete(key));
  const step=(now:number)=>act(()=>{const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(now));});
  const {container,rerender,unmount}=render(<AnimatedPartyLink active paused={false}/>);
  const path=()=>container.querySelector(".abyssa-expedition-party-link__main")!.getAttribute("d");
  step(100);step(150);
  const before=path();
  rerender(<AnimatedPartyLink active paused/>);
  expect(frames.size).toBe(0);expect(path()).toBe(before);
  rerender(<AnimatedPartyLink active paused={false}/>);
  step(8000);expect(path()).toBe(before);
  step(8050);expect(path()).not.toBe(before);
  rerender(<AnimatedPartyLink active={false} paused={false}/>);
  expect(path()).toBe("M32 90 C32 60, 32 30, 32 0");expect(frames.size).toBe(0);
  rerender(<AnimatedPartyLink active paused={false}/>);
  unmount();expect(frames.size).toBe(0);
});
