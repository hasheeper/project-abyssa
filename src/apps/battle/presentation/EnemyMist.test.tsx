import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./enemy-mist-renderer", () => ({createEnemyMistRenderer: vi.fn()}));
import { createEnemyMistRenderer } from "./enemy-mist-renderer";
import { EnemyMist } from "./EnemyMist";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { useBattleMotionPolicy } from "./useBattleMotionPolicy";

afterEach(() => {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it("holds a prepared fog frame during entrance, then resumes the same renderer without a new WebGL context", () => {
  const renderer={draw:vi.fn(),resize:vi.fn(),dispose:vi.fn()};
  vi.mocked(createEnemyMistRenderer).mockReturnValue(renderer);
  vi.stubGlobal("WebGLRenderingContext",class {});
  vi.stubGlobal("ResizeObserver",class {observe() {} disconnect() {}});
  vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  const frames=new Map<number,FrameRequestCallback>(); let next=0;
  vi.stubGlobal("requestAnimationFrame",(cb:FrameRequestCallback)=>{frames.set(++next,cb);return next;});
  vi.stubGlobal("cancelAnimationFrame",(id:number)=>{frames.delete(id);});
  const mounted=render(<EnemyMist paused/>);
  expect(createEnemyMistRenderer).toHaveBeenCalledTimes(1);
  expect(renderer.draw).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  fireEvent(document,new Event("visibilitychange"));
  expect(frames.size).toBe(0);
  const draws = renderer.draw.mock.calls.length, resizes = renderer.resize.mock.calls.length;
  mounted.rerender(<EnemyMist paused={false}/>);
  expect(frames.size).toBe(1);
  expect(createEnemyMistRenderer).toHaveBeenCalledTimes(1);
  mounted.rerender(<EnemyMist paused/>);
  expect(frames.size).toBe(0);
  mounted.rerender(<EnemyMist paused={false}/>);
  expect(frames.size).toBe(1);
  expect(createEnemyMistRenderer).toHaveBeenCalledTimes(1);
  expect(renderer.draw).toHaveBeenCalledTimes(draws);
  expect(renderer.resize).toHaveBeenCalledTimes(resizes);
  mounted.unmount();
  expect(frames.size).toBe(0);
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
});

it("uses the battle policy live, preserves the renderer, and draws once per three busy ticks",()=>{
  const renderer={draw:vi.fn(),resize:vi.fn(),dispose:vi.fn()};
  vi.mocked(createEnemyMistRenderer).mockClear().mockReturnValue(renderer);
  vi.stubGlobal("WebGLRenderingContext",class {});
  let resized:()=>void=()=>{};
  vi.stubGlobal("ResizeObserver",class {constructor(cb:()=>void){resized=cb;} observe(){} disconnect(){}});
  const frames=new Map<number,FrameRequestCallback>();let id=0;
  vi.stubGlobal("requestAnimationFrame",(cb:FrameRequestCallback)=>{frames.set(++id,cb);return id;});
  vi.stubGlobal("cancelAnimationFrame",(key:number)=>frames.delete(key));
  const step=(time:number)=>act(()=>{const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(time));});
  function Subject({busy=false,blocked=false}:{busy?:boolean;blocked?:boolean}) {
    const policy=useBattleMotionPolicy({blocked,foregroundBusy:busy});
    return <EnemyMist paused={policy.ambientPaused} foregroundBusy={policy.fogThrottled}/>;
  }
  const {rerender,unmount}=render(<UiMotionProvider><Subject/></UiMotionProvider>);
  renderer.draw.mockClear();
  step(1);step(51);step(101);step(151);
  expect(renderer.draw).toHaveBeenCalledTimes(3);
  renderer.draw.mockClear();
  rerender(<UiMotionProvider><Subject busy/></UiMotionProvider>);
  step(201);step(251);
  expect(renderer.draw).not.toHaveBeenCalled();
  step(301);expect(renderer.draw).toHaveBeenCalledTimes(1);
  rerender(<UiMotionProvider><Subject blocked/></UiMotionProvider>);
  expect(frames.size).toBe(0);
  const hidden=vi.spyOn(document,"hidden","get").mockReturnValue(true);
  fireEvent(document,new Event("visibilitychange"));
  act(()=>resized()); // hidden resizes are deferred until the page returns
  const before=renderer.resize.mock.calls.length;
  hidden.mockReturnValue(false);fireEvent(document,new Event("visibilitychange"));
  // Still blocked: policy stays paused, so no work until unblocked.
  expect(frames.size).toBe(0);
  rerender(<UiMotionProvider><Subject/></UiMotionProvider>);
  expect(renderer.resize).toHaveBeenCalledTimes(before+1);
  expect(frames.size).toBe(1);
  rerender(<UiMotionProvider preference="reduced"><Subject/></UiMotionProvider>);
  expect(frames.size).toBe(0);
  rerender(<UiMotionProvider><Subject/></UiMotionProvider>);
  expect(frames.size).toBe(1);
  expect(createEnemyMistRenderer).toHaveBeenCalledTimes(1);
  unmount();expect(frames.size).toBe(0);expect(renderer.dispose).toHaveBeenCalledTimes(1);
});
