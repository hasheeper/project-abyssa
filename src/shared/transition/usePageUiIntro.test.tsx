import { StrictMode, useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../ui/motion/UiMotionProvider";
import { SceneTransitionContext } from "./TransitionProvider";
import type { SceneTransitionPhase } from "./types";
import { usePageUiIntro } from "./usePageUiIntro";

const keys = ["Tab", "Enter", " ", "Escape"];
const durationMs = 1000;
type BoardProps = {
  ready?: boolean; suspended?: boolean; settleOnFocus?: boolean;
  inputRootSelector?: string; count?: number;
  onInput?: (state: string, prevented: boolean) => void;
};
function Board({ count = 0, onInput, settleOnFocus = true, ...options }: BoardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { state } = usePageUiIntro({ ref, durationMs, keys, settleOnFocus, ...options });
  return <section className="intro-root" data-testid="intro-root" data-state={state}>
    <div ref={ref} data-testid="viewport">
      <button onClick={e => onInput?.(state, e.defaultPrevented)}
        onPointerDown={e => onInput?.(state, e.defaultPrevented)}
        onKeyDown={e => onInput?.(state, e.defaultPrevented)}>inside {count}</button>
    </div>
    <button onClick={e => onInput?.(state, e.defaultPrevented)}>sibling</button>
  </section>;
}
function Scene({ phase = "idle", reduced = false, ...options }: BoardProps & {
  phase?: SceneTransitionPhase; reduced?: boolean;
}) {
  return <SceneTransitionContext.Provider value={{ phase, isTransitioning: phase !== "idle", navigate: () => true, holdReady: () => () => {} }}>
    <UiMotionProvider preference={reduced ? "reduced" : "system"}>
      <Board {...options}/><button>outside</button>
    </UiMotionProvider>
  </SceneTransitionContext.Provider>;
}
const root = () => screen.getByTestId("intro-root");
const inside = () => screen.getByRole("button", { name: /inside/ });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, "hidden", "get").mockReturnValue(false); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it("requires real readiness, released story ownership and an idle curtain even for early input", () => {
  const view = render(<Scene ready={false} suspended phase="closed"/>);
  for (const props of [
    { ready: false, suspended: false, phase: "idle" as const },
    { ready: true, suspended: true, phase: "idle" as const },
    { ready: true, suspended: false, phase: "opening" as const },
  ]) {
    view.rerender(<Scene {...props}/>);
    fireEvent.click(inside()); fireEvent.keyDown(document.body, { key: "Tab" });
    advance(2000);
    expect(root()).toHaveAttribute("data-state", "waiting");
    expect(vi.getTimerCount()).toBe(0);
  }
  view.rerender(<Scene/>);
  advance(durationMs - 1); expect(root()).toHaveAttribute("data-state", "playing");
  advance(1); expect(root()).toHaveAttribute("data-state", "ready");
});

it.each(["click", "pointer", "keyboard"])("settles synchronously before the %s business handler without consuming input", kind => {
  const onInput = vi.fn();
  render(<Scene onInput={onInput}/>);
  if (kind === "click") fireEvent.click(inside());
  if (kind === "pointer") fireEvent(inside(), new MouseEvent("pointerdown", { button: 0, bubbles: true }));
  if (kind === "keyboard") fireEvent.keyDown(inside(), { key: "Enter" });
  expect(onInput).toHaveBeenCalledExactlyOnceWith("ready", false);
  expect(vi.getTimerCount()).toBe(0);
});

it("ignores unrelated controls, modified/composing keys, unlisted keys and secondary pointers", () => {
  render(<Scene/>);
  fireEvent.keyDown(screen.getByRole("button", { name: "outside" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "outside" }));
  for (const option of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, { isComposing: true }]) {
    fireEvent.keyDown(inside(), { key: "Enter", ...option });
  }
  fireEvent.keyDown(inside(), { key: "Home" });
  fireEvent(inside(), new MouseEvent("pointerdown", { button: 2, bubbles: true }));
  expect(root()).toHaveAttribute("data-state", "playing");
  fireEvent.keyDown(document.body, { key: "Tab", shiftKey: true });
  expect(root()).toHaveAttribute("data-state", "ready");
});

it.each([true, false])("keeps settleOnFocus=%s explicit instead of imposing it on every page", settleOnFocus => {
  render(<Scene settleOnFocus={settleOnFocus}/>);
  fireEvent.focusIn(inside());
  expect(root()).toHaveAttribute("data-state", settleOnFocus ? "ready" : "playing");
  fireEvent.click(inside()); expect(root()).toHaveAttribute("data-state", "ready");
});

it("includes sibling chrome only when the page supplies its ancestor root", () => {
  const onInput = vi.fn();
  render(<Scene inputRootSelector=".intro-root" settleOnFocus={false} onInput={onInput}/>);
  fireEvent.click(screen.getByRole("button", { name: "outside" }));
  expect(root()).toHaveAttribute("data-state", "playing");
  fireEvent.click(screen.getByRole("button", { name: "sibling" }));
  expect(onInput).toHaveBeenCalledExactlyOnceWith("ready", false);
});

it("falls back to the referenced viewport when the optional ancestor is absent", () => {
  render(<Scene inputRootSelector=".missing-root"/>);
  fireEvent.click(screen.getByRole("button", { name: "sibling" }));
  expect(root()).toHaveAttribute("data-state", "playing");
  fireEvent.click(inside()); expect(root()).toHaveAttribute("data-state", "ready");
});

it("does not reset the score for content updates or readiness fluctuations", () => {
  const view = render(<StrictMode><Scene/></StrictMode>);
  advance(400);
  view.rerender(<StrictMode><Scene count={1} ready={false}/></StrictMode>);
  fireEvent.click(inside()); expect(root()).toHaveAttribute("data-state", "playing");
  advance(300);
  view.rerender(<StrictMode><Scene count={2}/></StrictMode>);
  advance(299); expect(root()).toHaveAttribute("data-state", "playing");
  advance(1); expect(root()).toHaveAttribute("data-state", "ready");
  view.rerender(<StrictMode><Scene count={3} ready={false}/></StrictMode>);
  view.rerender(<StrictMode><Scene count={4}/></StrictMode>);
  expect(root()).toHaveAttribute("data-state", "ready");
});

it.each(["reduced", "hidden", "suspended", "closing", "closed"] as const)("settles on %s and never replays on recovery", reason => {
  const view = render(<Scene/>);
  if (reason === "hidden") {
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
  } else view.rerender(<Scene reduced={reason === "reduced"} suspended={reason === "suspended"}
    phase={reason === "closing" || reason === "closed" ? reason : "idle"}/>);
  expect(root()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  view.rerender(<Scene/>);
  expect(root()).toHaveAttribute("data-state", "ready");
});

it.each(["hidden", "reduced"])("respects readiness before settling an initially %s page", reason => {
  if (reason === "hidden") vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  const view = render(<Scene ready={false} reduced={reason === "reduced"}/>);
  expect(root()).toHaveAttribute("data-state", "waiting");
  view.rerender(<Scene reduced={reason === "reduced"}/>);
  expect(root()).toHaveAttribute("data-state", "ready");
  expect(vi.getTimerCount()).toBe(0);
});

it("supports standalone mounts without a route provider and restarts only after remount", () => {
  const first = render(<Board/>);
  expect(root()).toHaveAttribute("data-state", "playing");
  advance(durationMs); first.unmount();
  render(<Board/>); expect(root()).toHaveAttribute("data-state", "playing");
});

it.each(["waiting", "playing", "ready"])("balances every listener and timer after StrictMode unmount from %s", state => {
  const add = vi.spyOn(EventTarget.prototype, "addEventListener");
  const remove = vi.spyOn(EventTarget.prototype, "removeEventListener");
  const raf = vi.spyOn(window, "requestAnimationFrame");
  const view = render(<StrictMode><Scene ready={state !== "waiting"} inputRootSelector=".intro-root"/></StrictMode>);
  if (state === "ready") advance(durationMs);
  expect(root()).toHaveAttribute("data-state", state);
  const subscriptions = add.mock.calls.length;
  view.rerender(<StrictMode><Scene ready={state !== "waiting"} inputRootSelector=".intro-root" count={1}/></StrictMode>);
  expect(add.mock.calls.length).toBe(subscriptions);
  view.unmount();
  const isOwned = (target: unknown, type: string) =>
    target === document ? ["keydown", "visibilitychange"].includes(type) :
      target instanceof HTMLElement && target.dataset.testid === "intro-root" && ["pointerdown", "click", "focusin"].includes(type);
  const additions = add.mock.calls.flatMap((args, i) => isOwned(add.mock.contexts[i], args[0]) ? [[add.mock.contexts[i], ...args]] : []);
  const removals = remove.mock.calls.flatMap((args, i) => isOwned(remove.mock.contexts[i], args[0]) ? [[remove.mock.contexts[i], ...args]] : []);
  expect(additions.length).toBeGreaterThan(0);
  for (const entry of additions) {
    const match = removals.findIndex(candidate => candidate.length === entry.length && candidate.every((value, i) => value === entry[i]));
    expect(match).toBeGreaterThanOrEqual(0);
    removals.splice(match, 1);
  }
  expect(removals).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
  expect(raf).not.toHaveBeenCalled();
});
