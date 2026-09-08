import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ActorPerformance } from "./ActorPerformance";
import { nod, shakeLight } from "./motions";

let animate: ReturnType<typeof vi.fn>, cancel: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers(); cancel=vi.fn(); animate=vi.fn(()=>({cancel}));
  vi.spyOn(document,"hidden","get").mockReturnValue(false);
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:animate});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();delete (HTMLElement.prototype as Partial<HTMLElement>).animate;});

it("starts the motion with the beat without waiting for seat entrance, once even in StrictMode",()=>{
  const cue={key:"one",motion:"nod" as const};
  const view=render(<StrictMode><ActorPerformance cue={cue}>actor</ActorPerformance></StrictMode>);
  act(()=>vi.advanceTimersByTime(0));expect(animate).toHaveBeenCalledExactlyOnceWith(nod().keyframes,nod().options);
  view.rerender(<StrictMode><ActorPerformance cue={{...cue}}>actor</ActorPerformance></StrictMode>);
  act(()=>vi.advanceTimersByTime(1000));expect(animate).toHaveBeenCalledTimes(1);
  view.rerender(<StrictMode><ActorPerformance cue={{key:"two",motion:"shakeLight"}}>actor</ActorPerformance></StrictMode>);
  act(()=>vi.advanceTimersByTime(0));expect(animate).toHaveBeenLastCalledWith(shakeLight().keyframes,shakeLight().options);
});
it("does not replay old gestures after LOG or tab visibility changes",()=>{
  const cue={key:"one",motion:"nod" as const};
  const view=render(<ActorPerformance cue={cue}>actor</ActorPerformance>);
  view.rerender(<ActorPerformance cue={cue} replay>actor</ActorPerformance>);
  view.rerender(<ActorPerformance cue={cue}>actor</ActorPerformance>);
  act(()=>vi.advanceTimersByTime(1000));expect(animate).not.toHaveBeenCalled();
  view.rerender(<ActorPerformance cue={{key:"two",motion:"nod"}}>actor</ActorPerformance>);
  vi.spyOn(document,"hidden","get").mockReturnValue(true);
  act(()=>document.dispatchEvent(new Event("visibilitychange")));
  act(()=>vi.advanceTimersByTime(1000));expect(animate).not.toHaveBeenCalled();
  view.unmount();expect(vi.getTimerCount()).toBe(0);
});
