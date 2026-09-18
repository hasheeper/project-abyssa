import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ComponentType, PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMansionPresentation } from "./useMansionPresentation";
import { prepareMansionAssets, type MansionArtwork } from "./mansion-assets";
import { MANSION_PASSAGE_TIMING, type MansionClock } from "./mansion-presentation-state";
import { waitForMansionImages } from "./mansion-image-readiness";
import type { CommittedBatch } from "../../game-client/session";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import type { MansionWeather } from "./mansion-weather";

vi.mock("./mansion-assets", async importOriginal => ({
  ...await importOriginal<typeof import("./mansion-assets")>(), prepareMansionAssets:vi.fn()
}));
vi.mock("./mansion-image-readiness", () => ({
  waitForMansionImages:vi.fn().mockResolvedValue(undefined), waitForMansionPaint:vi.fn().mockResolvedValue(undefined)
}));
const dawn: MansionClock = {day:1,phase:"dawn"};
const day: MansionClock = {day:1,phase:"day"};
function picture(phase:MansionClock["phase"],weather:MansionWeather="clear"): MansionArtwork {
  return {image:document.createElement("img"),phase,weather,kind:"layers",dispose:vi.fn()};
}
function deferred<T>() {
  let resolve!: (value:T) => void;
  const promise = new Promise<T>(done => {resolve=done;});
  return {promise,resolve};
}
beforeEach(() => {
  vi.mocked(prepareMansionAssets).mockReset().mockImplementation(async (_signal,phase,weather) => picture(phase,weather));
  vi.mocked(waitForMansionImages).mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("matchMedia",vi.fn(() => ({matches:true})));
});
afterEach(() => {cleanup();vi.useRealTimers();vi.unstubAllGlobals();});

function scene(
  advance = vi.fn<() => Promise<CommittedBatch|null>>().mockResolvedValue({} as CommittedBatch),
  wrapper?: ComponentType<PropsWithChildren>
) {
  const root = document.createElement("main");
  const sceneRef = {current:root};
  const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const view = renderHook(({clock,weather}:{clock:MansionClock;weather?:MansionWeather}) => useMansionPresentation({
    clock,weather,next:day,canAdvance:true,suspended:false,sceneRef,advance,refresh
  }), {initialProps:{clock:dawn} as {clock:MansionClock;weather?:MansionWeather},wrapper});
  return {...view,advance,refresh};
}

it("prepares and publishes an image for the displayed clock", async () => {
  const view = scene();
  await waitFor(() => expect(view.result.current.step).toBe("ready"));
  expect(view.result.current.artwork?.phase).toBe("dawn");
  expect(prepareMansionAssets).toHaveBeenCalledWith(expect.any(AbortSignal),"dawn","clear");
});

it("switches weather under the readiness cover without advancing or refreshing the save",async()=>{
  const view=scene();
  await waitFor(()=>expect(view.result.current.step).toBe("ready"));
  const old=view.result.current.artwork!,pending=deferred<MansionArtwork>();
  vi.mocked(prepareMansionAssets).mockReturnValueOnce(pending.promise);
  view.rerender({clock:dawn,weather:"rain"});
  await waitFor(()=>expect(prepareMansionAssets).toHaveBeenLastCalledWith(expect.any(AbortSignal),"dawn","rain"));
  expect(view.result.current.job).toBe("weather");
  expect(view.result.current.blocked).toBe(true);
  expect(view.result.current.artwork).toBe(old);
  expect(old.dispose).not.toHaveBeenCalled();
  await act(async()=>pending.resolve(picture("dawn","rain")));
  await waitFor(()=>expect(view.result.current.step).toBe("ready"));
  expect(view.result.current.artwork?.weather).toBe("rain");
  expect(view.result.current.clock).toEqual(dawn);
  expect(view.advance).not.toHaveBeenCalled();expect(view.refresh).not.toHaveBeenCalled();
  expect(old.dispose).toHaveBeenCalledOnce();
});

it("does not reveal stale weather when the requested preview changes during preparation",async()=>{
  const view=scene();
  await waitFor(()=>expect(view.result.current.step).toBe("ready"));
  const pending=deferred<MansionArtwork>();
  vi.mocked(prepareMansionAssets).mockReturnValueOnce(pending.promise);
  view.rerender({clock:dawn,weather:"cloudy"});
  await waitFor(()=>expect(prepareMansionAssets).toHaveBeenCalledTimes(2));
  view.rerender({clock:dawn,weather:"overcast"});
  const stale=picture("dawn","cloudy");
  await act(async()=>pending.resolve(stale));
  await waitFor(()=>expect(view.result.current.step).toBe("ready"));
  expect(view.result.current.artwork?.weather).toBe("overcast");
  expect(stale.dispose).toHaveBeenCalledOnce();
  expect(view.advance).not.toHaveBeenCalled();
});

it("keeps the old image during work, commits phase and image together, and ignores double advance", async () => {
  const saved = deferred<CommittedBatch|null>();
  const advance = vi.fn(() => saved.promise);
  const view = scene(advance);
  await waitFor(() => expect(view.result.current.step).toBe("ready"));
  const old = view.result.current.artwork!;
  act(() => {view.result.current.advance(); view.result.current.advance();});
  await waitFor(() => expect(advance).toHaveBeenCalledOnce());
  expect(view.result.current.clock).toEqual(dawn);
  expect(view.result.current.artwork).toBe(old);
  expect(old.dispose).not.toHaveBeenCalled();
  view.rerender({clock:day});
  await act(async () => {saved.resolve({} as CommittedBatch);});
  await waitFor(() => expect(view.result.current.step).toBe("ready"));
  expect(view.result.current.clock).toEqual(day);
  expect(view.result.current.artwork?.phase).toBe("day");
  expect(old.dispose).toHaveBeenCalledOnce();
});

it("never labels an old in-flight image with a newer external clock", async () => {
  const prepared = deferred<MansionArtwork>();
  vi.mocked(prepareMansionAssets).mockImplementationOnce(() => prepared.promise);
  const view = scene();
  await waitFor(() => expect(prepareMansionAssets).toHaveBeenCalledOnce());
  view.rerender({clock:day});
  const old = picture("dawn");
  await act(async () => {prepared.resolve(old);});
  await waitFor(() => expect(view.result.current.step).toBe("ready"));
  expect(prepareMansionAssets).toHaveBeenLastCalledWith(expect.any(AbortSignal),"day","clear");
  expect(view.result.current.clock.phase).toBe(view.result.current.artwork?.phase);
  expect(view.result.current.clock).toEqual(day);
  expect(old.dispose).toHaveBeenCalledOnce();
});

it("retries presentation after a saved phase without dispatching another phase command", async () => {
  const saved = deferred<CommittedBatch|null>();
  const advance = vi.fn(() => saved.promise);
  const view = scene(advance);
  await waitFor(() => expect(view.result.current.step).toBe("ready"));
  const old = view.result.current.artwork!;
  vi.mocked(prepareMansionAssets).mockRejectedValueOnce(Error("decode failed"));
  act(() => view.result.current.advance());
  await waitFor(() => expect(advance).toHaveBeenCalledOnce());
  view.rerender({clock:day});
  await act(async () => {saved.resolve({} as CommittedBatch);});
  await waitFor(() => expect(view.result.current.step).toBe("error"));
  expect(view.result.current.artwork).toBe(old);
  expect(old.dispose).not.toHaveBeenCalled();
  act(() => view.result.current.retry());
  await waitFor(() => expect(view.result.current.step).toBe("ready"));
  expect(advance).toHaveBeenCalledOnce();
  expect(view.refresh).toHaveBeenCalledOnce();
  expect(view.result.current.artwork?.phase).toBe("day");
});

it("disposes a late image after unmount instead of attaching or caching it", async () => {
  const prepared = deferred<MansionArtwork>();
  vi.mocked(prepareMansionAssets).mockImplementationOnce(() => prepared.promise);
  const view = scene();
  await waitFor(() => expect(prepareMansionAssets).toHaveBeenCalledOnce());
  view.unmount();
  const late = picture("dawn");
  await act(async () => {prepared.resolve(late);});
  expect(late.dispose).toHaveBeenCalledOnce();
});

async function elapse(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

it("covers the old scene before saving, then keeps input blocked until the reveal finishes", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia",vi.fn(() => ({matches:false})));
  const view = scene();
  await elapse(0);
  expect(view.result.current.step).toBe("paint");
  await elapse(MANSION_PASSAGE_TIMING.settle);
  expect(view.result.current.step).toBe("reveal");
  expect(view.result.current.blocked).toBe(true);
  act(() => view.result.current.advance());
  expect(view.advance).not.toHaveBeenCalled();
  await elapse(MANSION_PASSAGE_TIMING.reveal);
  expect(view.result.current.step).toBe("ready");
  const old = view.result.current.artwork;
  act(() => view.result.current.advance());
  expect(view.result.current.step).toBe("cover");
  await elapse(MANSION_PASSAGE_TIMING.cover - 1);
  expect(view.advance).not.toHaveBeenCalled();
  expect(view.result.current.artwork).toBe(old);
  await elapse(1);
  expect(view.advance).toHaveBeenCalledOnce();
});

it("never uses the animation timer to reveal undecoded images", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia",vi.fn(() => ({matches:false})));
  const decoded = deferred<void>();
  vi.mocked(waitForMansionImages).mockReturnValueOnce(decoded.promise);
  const view = scene();
  await elapse(0);
  await elapse(10_000);
  expect(view.result.current.step).toBe("paint");
  expect(view.result.current.blocked).toBe(true);
  await act(async () => { decoded.resolve(); });
  await elapse(MANSION_PASSAGE_TIMING.settle);
  expect(view.result.current.step).toBe("reveal");
  await elapse(MANSION_PASSAGE_TIMING.reveal);
  expect(view.result.current.step).toBe("ready");
});

it("re-covers an external clock change during reveal and ignores the old reveal timer", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia",vi.fn(() => ({matches:false})));
  const view = scene();
  await elapse(0);
  await elapse(MANSION_PASSAGE_TIMING.settle);
  expect(view.result.current.step).toBe("reveal");
  const nextImage = deferred<MansionArtwork>();
  vi.mocked(prepareMansionAssets).mockReturnValueOnce(nextImage.promise);
  view.rerender({clock:day});
  await elapse(MANSION_PASSAGE_TIMING.reveal);
  expect(view.result.current.step).toBe("work");
  expect(view.result.current.clock).toEqual(dawn);
  await act(async () => { nextImage.resolve(picture("day")); });
  await elapse(MANSION_PASSAGE_TIMING.settle);
  expect(view.result.current.step).toBe("reveal");
  expect(view.result.current.clock).toEqual(day);
});

it("waits for the route curtain to finish before starting the scene reveal", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia",vi.fn(() => ({matches:false})));
  let phase: SceneTransitionPhase = "closed";
  const wrapper = ({children}: PropsWithChildren) => <SceneTransitionContext.Provider value={{
    phase,isTransitioning:phase !== "idle",navigate:vi.fn(),holdReady:()=>()=>{}
  }}>{children}</SceneTransitionContext.Provider>;
  const view = scene(undefined, wrapper);
  await elapse(0);
  await elapse(5000);
  expect(view.result.current.step).toBe("paint");
  expect(view.result.current.motionPaused).toBe(true);
  phase = "opening";
  view.rerender({clock:dawn});
  await elapse(1000);
  expect(view.result.current.step).toBe("paint");
  expect(view.result.current.motionPaused).toBe(false);
  phase = "idle";
  view.rerender({clock:dawn});
  await elapse(MANSION_PASSAGE_TIMING.settle);
  expect(view.result.current.step).toBe("reveal");
  expect(view.result.current.blocked).toBe(true);
  await elapse(MANSION_PASSAGE_TIMING.reveal);
  expect(view.result.current.step).toBe("ready");
});
