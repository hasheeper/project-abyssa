import { StrictMode, useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { MANSION_UI_INTRO_MS, useMansionIntro } from "./useMansionIntro";

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, "hidden", "get").mockReturnValue(false); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function View({ready = true, suspended = false, count = 0}: {ready?: boolean; suspended?: boolean; count?: number}) {
  const ref = useRef<HTMLDivElement>(null);
  const intro = useMansionIntro(ready, suspended, ref);
  // Match the real page: chrome is a sibling of the referenced world viewport.
  return <div className="mansion-app" data-testid="scene" data-intro={intro}>
    <div ref={ref}/><button>仓库 {count}</button>
  </div>;
}
function Scene({phase = "idle", ...props}: Parameters<typeof View>[0] & {phase?: SceneTransitionPhase}) {
  return <SceneTransitionContext.Provider value={{phase, isTransitioning: phase !== "idle", navigate: () => true, holdReady: () => () => {}}}>
    <View {...props}/>
  </SceneTransitionContext.Provider>;
}
const scene = () => screen.getByTestId("scene");
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

it("waits for BOTH real scenery and the outgoing curtain, not the earlier paint stage", () => {
  const view = render(<Scene phase="closed" ready={false}/>);
  advance(2000); expect(scene()).toHaveAttribute("data-intro", "waiting");
  view.rerender(<Scene phase="opening" ready/>);
  advance(1000); expect(scene()).toHaveAttribute("data-intro", "waiting");
  view.rerender(<Scene ready={false}/>);
  expect(scene()).toHaveAttribute("data-intro", "waiting");
  view.rerender(<Scene ready/>);
  expect(scene()).toHaveAttribute("data-intro", "playing");
  advance(MANSION_UI_INTRO_MS - 1); expect(scene()).toHaveAttribute("data-intro", "playing");
  advance(1); expect(scene()).toHaveAttribute("data-intro", "ready");
});
it("plays once per mount, never after modal/data updates or a weather/time passage", () => {
  const view = render(<StrictMode><Scene/></StrictMode>);
  advance(MANSION_UI_INTRO_MS);
  view.rerender(<StrictMode><Scene ready={false} count={1}/></StrictMode>);
  view.rerender(<StrictMode><Scene ready count={2}/></StrictMode>);
  expect(scene()).toHaveAttribute("data-intro", "ready");
  view.unmount(); render(<Scene/>);
  expect(scene()).toHaveAttribute("data-intro", "playing");
});
it("waits through initial story ownership; a later story never resets the entrance", () => {
  const view = render(<Scene suspended/>);
  advance(2000); expect(scene()).toHaveAttribute("data-intro", "waiting");
  view.rerender(<Scene/>); expect(scene()).toHaveAttribute("data-intro", "playing");
  view.rerender(<Scene suspended/>); expect(scene()).toHaveAttribute("data-intro", "ready");
  view.rerender(<Scene/>); expect(scene()).toHaveAttribute("data-intro", "ready");
});
it("early input settles the UI without swallowing the action or bypassing scene readiness", () => {
  const view = render(<Scene ready={false}/>);
  fireEvent.keyDown(document.body, {key:"Tab"}); expect(scene()).toHaveAttribute("data-intro", "waiting");
  view.rerender(<Scene/>);
  fireEvent.click(screen.getByRole("button"));
  expect(scene()).toHaveAttribute("data-intro", "ready"); expect(vi.getTimerCount()).toBe(0);
});
it("releases motion for live reduced preference, tab hiding, navigation and unmount", () => {
  const view = render(<UiMotionProvider preference="system"><Scene/></UiMotionProvider>);
  view.rerender(<UiMotionProvider preference="reduced"><Scene/></UiMotionProvider>);
  expect(scene()).toHaveAttribute("data-intro", "ready");
  view.rerender(<UiMotionProvider preference="system"><Scene/></UiMotionProvider>);
  expect(scene()).toHaveAttribute("data-intro", "ready"); view.unmount();
  const next = render(<Scene/>);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(scene()).toHaveAttribute("data-intro", "ready"); next.unmount();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const leaving = render(<Scene/>); leaving.rerender(<Scene phase="closing"/>);
  expect(scene()).toHaveAttribute("data-intro", "ready"); leaving.unmount();
  const interrupted = render(<Scene/>); interrupted.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps sibling chrome interactive but does not finish on dialog autofocus", () => {
  render(<Scene/>);
  fireEvent.focusIn(screen.getByRole("button"));
  expect(scene()).toHaveAttribute("data-intro", "playing");
  fireEvent.keyDown(document.body, {key:"Home"});
  fireEvent.keyDown(document.body, {key:"PageDown"});
  expect(scene()).toHaveAttribute("data-intro", "playing");
  fireEvent.keyDown(screen.getByRole("button"), {key:"Escape"});
  expect(scene()).toHaveAttribute("data-intro", "ready");
});
