import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import { useMapIntro } from "./useMapIntro";
import { MAP_INTRO_DURATION_MS } from "./map-landmark-intro";

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, "hidden", "get").mockReturnValue(false); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function Board({ ready }: { ready: boolean }) {
  const intro = useMapIntro(ready);
  return <div ref={intro.ref} data-testid="board" data-state={intro.state}><button>open</button></div>;
}
function Scene({ ready = true, phase = "idle", reduced = false }: { ready?: boolean; phase?: SceneTransitionPhase; reduced?: boolean }) {
  return <StrictMode><SceneTransitionContext.Provider value={{ phase, isTransitioning: phase !== "idle", navigate: () => true, holdReady: () => () => {} }}>
    <UiMotionProvider preference={reduced ? "reduced" : "system"}><Board ready={ready}/></UiMotionProvider>
  </SceneTransitionContext.Provider></StrictMode>;
}
it("waits for both the actual map and the uncovered curtain", () => {
  const view = render(<Scene ready={false}/>);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene phase="opening"/>);
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene/>);
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "playing");
  act(() => vi.advanceTimersByTime(MAP_INTRO_DURATION_MS));
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});
it("finishes for early input, without replaying on a later ready signal", () => {
  const view = render(<Scene/>);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "ready");
  view.rerender(<Scene ready={false}/>); view.rerender(<Scene/>);
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "ready");
});
it("honors live manual reduction and cancels its timer on departure/unmount", () => {
  const view = render(<Scene/>);
  view.rerender(<Scene reduced/>);
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
  view.unmount();
  const next = render(<Scene/>);
  next.rerender(<Scene phase="closing"/>);
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "ready");
  next.unmount(); expect(vi.getTimerCount()).toBe(0);
});
it("settles immediately in a hidden document", () => {
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  render(<Scene/>);
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "ready");
});
it("keeps map navigation keys distinct from archive and shop paging", () => {
  render(<Scene/>);
  fireEvent.keyDown(document.body, {key:"Home"});
  fireEvent.keyDown(document.body, {key:"PageDown"});
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "playing");
  fireEvent.keyDown(document.body, {key:"Escape"});
  expect(screen.getByTestId("board")).toHaveAttribute("data-state", "ready");
});
