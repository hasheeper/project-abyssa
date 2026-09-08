import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EmotionActor, EMOTION_CUE_MS } from "./EmotionActor";
import type { ResolvedEmotion } from "./emotion-cues";
import { resolveEmotePlacement } from "./emotes";

const cue: ResolvedEmotion = {key:"line-1",trigger:"joy",expression:"c",emote:"note",motion:{id:"jump",amplitude:9,duration:570}};
let animate: ReturnType<typeof vi.fn>, cancel: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers(); cancel = vi.fn(); animate = vi.fn(() => ({cancel}));
  vi.stubGlobal("matchMedia",vi.fn(() => ({matches:false})));
  vi.spyOn(document,"hidden","get").mockReturnValue(false);
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:animate});
});
afterEach(() => {cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();delete (HTMLElement.prototype as Partial<HTMLElement>).animate;});
const advance = (ms: number) => act(() => {vi.advanceTimersByTime(ms);});

it("plays once in StrictMode, then unmounts the APNG instead of looping forever", () => {
  const view = render(<StrictMode><EmotionActor characterId="norma" cue={cue} active delay={100}>figure</EmotionActor></StrictMode>);
  advance(100); expect(animate).toHaveBeenCalledTimes(1);
  const bubble = view.container.querySelector<HTMLElement>(".abyssa-emote")!;
  const position = resolveEmotePlacement("norma","note");
  expect(bubble.style.getPropertyValue("--abyssa-emote-x")).toBe(`${position.x}%`);
  expect(bubble.style.getPropertyValue("--abyssa-emote-size")).toBe(`${position.size}%`);
  expect(bubble.style.left).toBe(""); // No second head-anchor/side-flip positioning system.
  view.rerender(<StrictMode><EmotionActor characterId="norma" cue={{...cue}} active delay={100}>new line</EmotionActor></StrictMode>);
  advance(EMOTION_CUE_MS); expect(animate).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector(".abyssa-emote")).toBeNull();
});
it("passes the original merged calibration through unchanged", () => {
  const view = render(<EmotionActor characterId="norma" cue={cue} active placement={{x:12,y:8,size:41}}>figure</EmotionActor>);
  advance(0);
  const style = view.container.querySelector<HTMLElement>(".abyssa-emote")!.style;
  expect(["x","y","size"].map(k=>style.getPropertyValue(`--abyssa-emote-${k}`))).toEqual(["12%","8%","41%"]);
});
it("cancels interrupted cues and does not revive an old bubble when speaker focus returns", () => {
  const view=render(<EmotionActor characterId="norma" cue={cue} active>figure</EmotionActor>);
  advance(0);
  view.rerender(<EmotionActor characterId="norma" cue={cue} active={false}>figure</EmotionActor>);
  expect(cancel).toHaveBeenCalled(); expect(view.container.querySelector(".abyssa-emote")).toBeNull();
  view.rerender(<EmotionActor characterId="norma" cue={cue} active>figure</EmotionActor>);
  advance(500); expect(animate).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector(".abyssa-emote")).toBeNull();
});
it("does not animate restored/reviewed lines; subsequent new emotion can play", () => {
  const view=render(<EmotionActor characterId="norma" cue={cue} active hydrate>figure</EmotionActor>);
  advance(0); expect(animate).not.toHaveBeenCalled();
  view.rerender(<EmotionActor characterId="norma" cue={{...cue,key:"line-2"}} active hydrate>figure</EmotionActor>);
  advance(0); expect(animate).toHaveBeenCalledTimes(1);
  view.rerender(<EmotionActor characterId="norma" cue={{...cue,key:"line-3"}} active replay>figure</EmotionActor>);
  advance(0); expect(animate).toHaveBeenCalledTimes(1); expect(view.container.querySelector(".abyssa-emote")).toBeNull();
});
it("cleans up hidden pages and cancels pending starts on unmount", () => {
  const view=render(<EmotionActor characterId="norma" cue={cue} active delay={100}>figure</EmotionActor>);
  vi.spyOn(document,"hidden","get").mockReturnValue(true);
  act(()=>document.dispatchEvent(new Event("visibilitychange")));
  advance(100); expect(animate).not.toHaveBeenCalled();
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});
it("respects reduced motion while retaining the emotion bubble", () => {
  vi.mocked(window.matchMedia).mockReturnValue({matches:true} as MediaQueryList);
  const view=render(<EmotionActor characterId="norma" cue={cue} active>figure</EmotionActor>);
  advance(0); expect(animate).not.toHaveBeenCalled(); expect(view.container.querySelector(".abyssa-emote")).not.toBeNull();
});
