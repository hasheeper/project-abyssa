import { StrictMode, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import { useMenuIntro } from "./useMenuIntro";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";

let reduced: boolean;
let preferences: Set<() => void>;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false; preferences = new Set();
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return reduced; },
    addEventListener: (_: string, listener: () => void) => preferences.add(listener),
    removeEventListener: (_: string, listener: () => void) => preferences.delete(listener)
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Scene({ phase }: { phase: SceneTransitionPhase }) {
  const intro = useMenuIntro(phase);
  const [line, setLine] = useState("first line");
  return <div ref={intro.ref} data-testid="intro" data-state={intro.state}
    data-reduced={intro.reducedMotion} inert={intro.blocked}>
    <button onClick={() => setLine("selected line")}>select</button>
    <output>{intro.speechReady ? line : ""}</output>
  </div>;
}
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const intro = () => screen.getByTestId("intro");

it("waits behind the curtain and keeps its clock through opening -> idle", () => {
  const { rerender } = render(<Scene phase="closed" />);
  advance(5000);
  expect(intro()).toHaveAttribute("data-state", "waiting");
  expect(intro()).toHaveAttribute("inert");
  expect(screen.getByRole("status")).toHaveTextContent("");
  rerender(<Scene phase="opening" />);
  expect(intro()).toHaveAttribute("data-state", "playing");
  advance(620);
  rerender(<Scene phase="idle" />);
  expect(intro()).not.toHaveAttribute("inert");
  expect(screen.getByRole("status")).toHaveTextContent("");
  advance(480);
  expect(screen.getByRole("status")).toHaveTextContent("first line");
  expect(intro()).toHaveAttribute("data-state", "playing");
  advance(260);
  expect(intro()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});

it("uses the full timeline on every remount, including after an aborted mount and StrictMode", () => {
  const abandoned = render(<Scene phase="closed" />);
  abandoned.unmount();
  for (let visit = 0; visit < 3; visit++) {
    const view = render(<StrictMode><Scene phase="opening" /></StrictMode>);
    expect(intro()).toHaveAttribute("data-state", "playing");
    advance(1099);
    expect(screen.getByRole("status")).toHaveTextContent("");
    advance(1);
    expect(screen.getByRole("status")).toHaveTextContent("first line");
    advance(259);
    expect(intro()).toHaveAttribute("data-state", "playing");
    advance(1);
    expect(intro()).toHaveAttribute("data-state", "ready");
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  }
});

it("uses the same speech and completion timing for direct entry without a curtain", () => {
  const { rerender } = render(<Scene phase="closed" />);
  advance(1000);
  expect(intro()).toHaveAttribute("data-state", "waiting");
  rerender(<Scene phase="idle" />);
  expect(intro()).not.toHaveAttribute("inert");
  expect(intro()).toHaveAttribute("data-state", "playing");
  advance(1099);
  expect(intro()).toHaveAttribute("data-state", "playing");
  expect(screen.getByRole("status")).toHaveTextContent("");
  advance(1);
  expect(screen.getByRole("status")).toHaveTextContent("first line");
  expect(intro()).toHaveAttribute("data-state", "playing");
  advance(260);
  expect(intro()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});

it("finishes before pointer actions without overwriting the chosen dialogue later", () => {
  render(<Scene phase="idle" />);
  fireEvent.pointerDown(screen.getByRole("button"), { button: 0 });
  fireEvent.click(screen.getByRole("button"));
  expect(intro()).toHaveAttribute("data-state", "ready");
  expect(screen.getByRole("status")).toHaveTextContent("selected line");
  advance(2000);
  expect(screen.getByRole("status")).toHaveTextContent("selected line");
  expect(vi.getTimerCount()).toBe(0);
});

it("reveals before early Tab focus but ignores unrelated controls and modifier shortcuts", () => {
  const { rerender } = render(<><Scene phase="opening" /><input aria-label="outside" /></>);
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(intro()).toHaveAttribute("data-state", "playing");
  rerender(<><Scene phase="idle" /><input aria-label="outside" /></>);
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  fireEvent.keyDown(document.body, { key: "ArrowDown", metaKey: true });
  expect(intro()).toHaveAttribute("data-state", "playing");
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(intro()).toHaveAttribute("data-state", "ready");
  expect(screen.getByRole("status")).toHaveTextContent("first line");
});

it("honors reduced motion initially and if the preference changes during entry", () => {
  reduced = true;
  const first = render(<Scene phase="opening" />);
  expect(intro()).toHaveAttribute("data-state", "ready");
  expect(intro()).toHaveAttribute("data-reduced", "true");
  expect(vi.getTimerCount()).toBe(0);
  first.unmount();
  reduced = false;
  render(<Scene phase="idle" />);
  expect(intro()).toHaveAttribute("data-state", "playing");
  reduced = true;
  act(() => preferences.forEach(listener => listener()));
  expect(intro()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
  reduced = false;
  act(() => preferences.forEach(listener => listener()));
  expect(intro()).toHaveAttribute("data-state", "ready");
});

it("cancels pending speech and motion on departure without hiding the outgoing page", () => {
  const { rerender, unmount } = render(<Scene phase="opening" />);
  advance(200);
  rerender(<Scene phase="closing" />);
  expect(intro()).toHaveAttribute("data-state", "ready");
  expect(intro()).toHaveAttribute("inert");
  expect(vi.getTimerCount()).toBe(0);
  unmount();
  expect(preferences.size).toBe(0);
});

it("finishes for the shared manual reduced-motion preference as well", () => {
  const view = render(<UiMotionProvider preference="system"><Scene phase="idle" /></UiMotionProvider>);
  expect(intro()).toHaveAttribute("data-state", "playing");
  view.rerender(<UiMotionProvider preference="reduced"><Scene phase="idle" /></UiMotionProvider>);
  expect(intro()).toHaveAttribute("data-state", "ready");
  expect(intro()).toHaveAttribute("data-reduced", "true");
  expect(vi.getTimerCount()).toBe(0);
});

it("does not replay on tab return and removes timers when unmounted midway", () => {
  const first = render(<Scene phase="opening" />);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(intro()).toHaveAttribute("data-state", "ready");
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  expect(intro()).toHaveAttribute("data-state", "ready");
  first.unmount();
  const next = render(<Scene phase="opening" />);
  advance(150);
  next.unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(preferences.size).toBe(0);
});
