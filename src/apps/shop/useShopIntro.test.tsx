import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { SHOP_INTRO_END_MS, useShopIntro } from "./useShopIntro";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function Board({ item = "护符" }: { item?: string }) {
  const intro = useShopIntro();
  return <div ref={intro.ref} data-testid="board" data-state={intro.state}><button>{item}</button></div>;
}
function Scene({ phase }: { phase: SceneTransitionPhase }) {
  return <SceneTransitionContext.Provider value={{ phase, isTransitioning: phase !== "idle", navigate: () => true, holdReady: () => () => {} }}>
    <Board />
  </SceneTransitionContext.Provider>;
}
const board = () => screen.getByTestId("board");
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

it("preserves shop Escape, Home/End and PageUp/PageDown shortcuts", () => {
  for (const key of ["Escape", "Home", "End", "PageUp", "PageDown"]) {
    const view = render(<Board/>);
    fireEvent.keyDown(document.body, {key});
    expect(board()).toHaveAttribute("data-state", "ready");
    view.unmount();
  }
});

it("waits until the curtain has uncovered the background, then plays the complete visible score", () => {
  const view = render(<Scene phase="closed" />);
  advance(2000);
  expect(board()).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene phase="opening" />);
  advance(620);
  expect(board()).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene phase="idle" />);
  advance(SHOP_INTRO_END_MS - 1);
  expect(board()).toHaveAttribute("data-state", "playing");
  advance(1);
  expect(board()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});
it("uses one entrance for refresh and route return in StrictMode, not for item/data updates", () => {
  for (let i = 0; i < 2; i++) {
    const view = render(<StrictMode><Board /></StrictMode>);
    expect(board()).toHaveAttribute("data-state", "playing");
    advance(SHOP_INTRO_END_MS);
    view.rerender(<StrictMode><Board item="圣水" /></StrictMode>);
    expect(board()).toHaveAttribute("data-state", "ready");
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  }
});
it("settles on early input without losing the action, but not through the curtain", () => {
  const view = render(<Scene phase="opening" />);
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(board()).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene phase="idle" />);
  fireEvent.pointerDown(screen.getByRole("button"), { button: 0 });
  fireEvent.click(screen.getByRole("button"));
  expect(board()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});
it("settles for keyboard paging, while unrelated input cannot skip the entrance", () => {
  render(<><Board /><input aria-label="其他控件" /></>);
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "PageDown" });
  expect(board()).toHaveAttribute("data-state", "playing");
  fireEvent.keyDown(document.body, { key: "PageDown" });
  expect(board()).toHaveAttribute("data-state", "ready");
});
it("settles immediately for reduced motion and never replays when motion is restored", () => {
  const view = render(<UiMotionProvider preference="system"><Board /></UiMotionProvider>);
  view.rerender(<UiMotionProvider preference="reduced"><Board /></UiMotionProvider>);
  expect(board()).toHaveAttribute("data-state", "ready");
  view.rerender(<UiMotionProvider preference="system"><Board /></UiMotionProvider>);
  expect(board()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});
it("releases timers on tab hiding, departure and interrupted unmount", () => {
  const view = render(<Board />);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(board()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
  view.unmount();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const next = render(<Scene phase="idle" />);
  next.rerender(<Scene phase="closing" />);
  expect(board()).toHaveAttribute("data-state", "ready");
  next.unmount();
  const interrupted = render(<Board />);
  interrupted.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
