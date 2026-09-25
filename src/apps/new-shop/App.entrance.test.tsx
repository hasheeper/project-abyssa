import { StrictMode, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { shopDialogue } from "../../content/presentation/shop-dialogue";
import { App } from "./App";

const preparation = vi.hoisted(() => ({prepare: vi.fn(), busy: false}));
vi.mock("../../game-client/shop/entrance-assets", () => ({prepareNewShopAssets: preparation.prepare}));
vi.mock("../../shared/presentation/adv/SceneSequence", () => ({useSceneSequenceBusy: () => preparation.busy}));
vi.mock("../../shared/stage", () => ({Stage: ({children}: {children: ReactNode}) => <>{children}</>}));
// Test queue identity here; the browser regression covers shared notice animation/lifetime.
vi.mock("../../shared/ui/patterns/SceneFeedback", () => ({SceneFeedback: ({entries, paused}: {entries: {id: string}[]; paused: boolean}) =>
  <div data-testid="feedback" data-paused={paused}>{entries.map(entry => <span key={entry.id}>{entry.id}</span>)}</div>}));
let resolve: () => void, reject: (error: Error) => void;
function pending() {
  const promise = new Promise<void>((yes, no) => {resolve = yes; reject = no;});
  preparation.prepare.mockReturnValue(promise);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  preparation.prepare.mockReset(); preparation.busy = false; pending();
});
afterEach(() => {cleanup(); vi.useRealTimers(); vi.restoreAllMocks();});
const root = () => document.querySelector(".new-shop")!;
const dialogue = () => screen.queryByLabelText("缇比的对话");
const button = (name: string) => screen.getByRole("button", {name});
const tab = (name: string) => screen.getByRole("tab", {name});
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const load = () => act(async () => {resolve();});
async function start() {await load(); tick(240);}

it("waits for assets and reveal, then stages 1120ms before starting the actual typewriter", async () => {
  render(<StrictMode><App /></StrictMode>);
  tick(5000);
  expect(root()).toHaveAttribute("data-shop-intro", "waiting");
  expect(dialogue()).toBeNull();
  expect(screen.queryByLabelText("商店功能")).toBeNull();
  await load(); tick(239);
  expect(screen.getByLabelText("商店功能")).toHaveAttribute("inert");
  expect(root()).toHaveAttribute("data-shop-intro", "waiting");
  tick(1); tick(1119);
  expect(root()).toHaveAttribute("data-shop-intro", "playing");
  expect(dialogue()).toBeNull();
  tick(1);
  expect(root()).toHaveAttribute("data-shop-intro", "ready");
  expect(dialogue()?.textContent).toBe("");
  tick(28);
  expect(dialogue()).toHaveTextContent(shopDialogue.buy.text.slice(0, 1));
  expect(dialogue()).not.toHaveTextContent(shopDialogue.buy.text);
});

it("keeps a failed preparation covered and retries the actual resource promise", async () => {
  const view = render(<App />);
  await act(async () => reject(new Error("missing art")));
  expect(screen.getByRole("alert")).toHaveTextContent("店铺暂时未能打开");
  expect(dialogue()).toBeNull();
  pending(); fireEvent.click(button("重新加载"));
  expect(screen.queryByRole("alert")).toBeNull();
  await start();
  expect(root()).toHaveAttribute("data-shop-intro", "playing");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("settles before the original purchase click, applies it once, and reads the new line", async () => {
  render(<App />); await start(); tick(350);
  fireEvent.click(button("购买"));
  expect(root()).toHaveAttribute("data-shop-intro", "ready");
  expect(screen.getByLabelText("小队资金余额 4,000 G")).toBeInTheDocument();
  expect(screen.getByRole("option", {name: "护符"})).toHaveTextContent("1 / 2");
  expect(screen.getByTestId("feedback").children).toHaveLength(1);
  tick(28);
  expect(dialogue()).toHaveTextContent(shopDialogue.purchased.text.slice(0, 1));
  fireEvent.click(tab("探索"));
  expect(root()).toHaveAttribute("data-shop-intro", "ready");
  fireEvent.click(tab("出售"));
  expect(root()).toHaveAttribute("data-shop-intro", "ready");
});

it("replays only presentation, preserving inventory DOM, balances and pending notices", async () => {
  render(<App />); await start();
  fireEvent.click(button("购买"));
  const row = screen.getByRole("option", {name: "护符"});
  fireEvent.click(button("重播进场"));
  expect(root()).toHaveAttribute("data-shop-intro", "playing");
  expect(screen.getByRole("option", {name: "护符"})).toBe(row);
  expect(row).toHaveTextContent("1 / 2");
  expect(screen.getByLabelText("小队资金余额 4,000 G")).toBeInTheDocument();
  expect(screen.getByTestId("feedback")).toHaveAttribute("data-paused", "true");
  expect(screen.getByTestId("feedback").children).toHaveLength(1);
  expect(dialogue()).toBeNull();
  fireEvent.click(button("短衔接"));
  expect(root()).toHaveAttribute("data-entry-profile", "handoff");
  tick(479); expect(root()).toHaveAttribute("data-shop-intro", "playing");
  tick(1); expect(root()).toHaveAttribute("data-shop-intro", "ready");
  expect(screen.getByLabelText("小队资金余额 4,000 G")).toBeInTheDocument();
  expect(screen.getByTestId("feedback").children).toHaveLength(1);
});

it("settles on keyboard navigation and prevents replay from interrupting appraisal", async () => {
  render(<App />); await start();
  fireEvent.keyDown(tab("购买"), {key: "ArrowUp"});
  expect(tab("鉴定")).toHaveAttribute("aria-selected", "true");
  expect(root()).toHaveAttribute("data-shop-intro", "ready");
  fireEvent.click(button("鉴定"));
  expect(button("重播进场")).toBeDisabled();
  expect(button("短衔接")).toBeDisabled();
  expect(screen.getByLabelText("小队资金余额 4,100 G")).toBeInTheDocument();
  const mainAction = document.querySelector(".new-shop-detail .new-shop__action")!;
  expect(mainAction).toHaveFocus();
  expect(document.querySelector(".new-shop__merchant button")).toBeNull();
  for (let i = 0; i < 3; i++) {
    expect(button("显示完整台词")).toBe(mainAction);
    fireEvent.click(mainAction);
    expect(button(i === 2 ? "收好" : "继续鉴定")).toBe(mainAction);
    fireEvent.click(mainAction);
  }
  expect(button("去出售")).toBeInTheDocument();
  expect(button("重播进场")).toBeEnabled();
  fireEvent.click(button("重播进场")); tick(1120);
  expect(button("去出售")).toBeInTheDocument();
  expect(screen.getByLabelText("小队资金余额 4,100 G")).toBeInTheDocument();
});

function Scene({phase, reduced = false}: {phase: SceneTransitionPhase; reduced?: boolean}) {
  return <SceneTransitionContext.Provider value={{phase, isTransitioning: phase !== "idle", navigate: () => true, holdReady: () => () => {}}}>
    <UiMotionProvider preference={reduced ? "reduced" : "system"}><App /></UiMotionProvider>
  </SceneTransitionContext.Provider>;
}
it("does not spend the score behind an external curtain or a busy story sequence", async () => {
  const view = render(<Scene phase="closed" />);
  await load(); tick(5000);
  expect(root()).toHaveAttribute("data-shop-intro", "waiting");
  expect(document.querySelector(".new-shop__preparing")).toBeNull();
  view.rerender(<Scene phase="opening" />); tick(700);
  expect(root()).toHaveAttribute("data-shop-intro", "waiting");
  preparation.busy = true; view.rerender(<Scene phase="idle" />); tick(1500);
  expect(root()).toHaveAttribute("data-shop-intro", "waiting");
  preparation.busy = false; view.rerender(<Scene phase="idle" />);
  tick(1119); expect(root()).toHaveAttribute("data-shop-intro", "playing");
  tick(1); expect(root()).toHaveAttribute("data-shop-intro", "ready");
});

it.each(["hidden", "reduced"])("settles on %s without replaying the dialogue on recovery", async reason => {
  const view = render(<Scene phase="idle" />); await load();
  if (reason === "hidden") {
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
  } else view.rerender(<Scene phase="idle" reduced />);
  expect(root()).toHaveAttribute("data-shop-intro", "ready");
  const speech = dialogue(); tick(56);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  view.rerender(<Scene phase="idle" />);
  expect(dialogue()).toBe(speech);
  expect(dialogue()).toHaveTextContent(shopDialogue.buy.text.slice(0, 2));
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});
