import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { useCharacterIntro } from "./useCharacterIntro";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function Board() {
  const intro = useCharacterIntro();
  return <main ref={intro.ref} data-testid="board" data-state={intro.state}><button>select</button></main>;
}
function Scene({ phase }: { phase: SceneTransitionPhase }) {
  return <SceneTransitionContext.Provider value={{ phase, isTransitioning: phase !== "idle", navigate: () => true, holdReady: () => () => {} }}>
    <Board />
  </SceneTransitionContext.Provider>;
}
const board = () => screen.getByTestId("board");
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

it("keeps archive focus/navigation policy without inheriting Escape or shop paging", () => {
  const view = render(<Board/>);
  fireEvent.keyDown(document.body, {key:"Escape"});
  fireEvent.keyDown(document.body, {key:"PageDown"});
  expect(board()).toHaveAttribute("data-state", "playing");
  fireEvent.keyDown(document.body, {key:"Home"});
  expect(board()).toHaveAttribute("data-state", "ready");
  view.unmount(); render(<Board/>);
  fireEvent.focusIn(screen.getByRole("button"));
  expect(board()).toHaveAttribute("data-state", "ready");
});

it("waits for the curtain to uncover the backdrop before the visible board entrance", () => {
  const view = render(<Scene phase="closed" />);
  advance(2000);
  expect(board()).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene phase="opening" />);
  advance(500);
  expect(board()).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene phase="idle" />);
  advance(919);
  expect(board()).toHaveAttribute("data-state", "playing");
  advance(1);
  expect(board()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});
it("uses the same timeline for direct entry, refresh and remount in StrictMode", () => {
  for (let i = 0; i < 3; i++) {
    const view = render(<StrictMode><Board /></StrictMode>);
    expect(board()).toHaveAttribute("data-state", "playing");
    advance(919);
    expect(board()).toHaveAttribute("data-state", "playing");
    advance(1);
    expect(board()).toHaveAttribute("data-state", "ready");
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  }
});
it("finishes before early focus/input, but not while the curtain blocks input", () => {
  const view = render(<Scene phase="opening" />);
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(board()).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene phase="idle" />);
  fireEvent.click(screen.getByRole("button"));
  expect(board()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});
it("finishes for manual reduction and never replays when full motion is restored", () => {
  const view = render(<UiMotionProvider preference="system"><Board /></UiMotionProvider>);
  view.rerender(<UiMotionProvider preference="reduced"><Board /></UiMotionProvider>);
  expect(board()).toHaveAttribute("data-state", "ready");
  view.rerender(<UiMotionProvider preference="system"><Board /></UiMotionProvider>);
  expect(board()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});
it("cleans up on hiding, departure and an interrupted mount", () => {
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
  expect(vi.getTimerCount()).toBe(0);
});
