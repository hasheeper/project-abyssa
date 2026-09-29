import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { LootSettlementView } from "../loot/LootSettlementView";
import type { LootSettlement } from "../loot/loot-types";
import { ExpeditionBattleSurface, type BattleSurfaceProps } from "./ExpeditionBattleSurface";
import type { LedgerStageMode } from "./ledger-stage";

const noop = () => {};
const base: BattleSurfaceProps = {
  label: "战斗", onSettle: noop, party: [], presentedEnemies: [], phase: "complete",
  layerClearPending: false, isRolling: false, interactive: false, heldActor: null,
  attackFx: null, supportFx: null, enemyTurnFx: null, isPresentationBusy: () => false,
  handleMemberCardClick: noop, handleEnemyClick: noop, handleIntentClick: noop,
  dicePanel: <button>旧行动</button>, sidebar: null, overlays: null,
};
const pocket = {copper: 0, items: []};
const receipt: LootSettlement = {id: "terminal:1", outcome: "cleared", layer: 1,
  banked: pocket, unbanked: pocket, returned: {copper: 120, items: []}, lostBanked: pocket, lostUnbanked: pocket};
function Subject({id = "run:1", mode = "stow", reduced = false, active = true, busy = false, error, confirm = noop}: {
  id?: string; mode?: LedgerStageMode; reduced?: boolean; active?: boolean; busy?: boolean; error?: string; confirm?: () => void;
}) {
  return <UiMotionProvider preference={reduced ? "reduced" : "system"}><ExpeditionBattleSurface {...base}
    settlement={active ? {id, mode, outcome: "cleared", content: <LootSettlementView receipt={{...receipt}} catalog={{}}
      context={{locationName: "归途"}} onConfirm={confirm} busy={busy} error={error}/>} : undefined}/></UiMotionProvider>;
}
const root = () => screen.getByRole("main", {name: "战斗"});
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it("keeps combat inert while stowing, then mounts one receipt inside the same board", () => {
  const confirm = vi.fn();
  render(<Subject confirm={confirm}/>);
  const board = root().querySelector(".abyssa-expedition-frame__board")!;
  expect(board.querySelector(".abyssa-expedition-frame__interior")).toHaveAttribute("inert");
  expect(screen.queryByRole("dialog")).toBeNull();
  advance(1250);
  expect(root()).toHaveAttribute("data-ledger-lid");
  expect(root()).not.toHaveAttribute("data-ledger-page");
  advance(1550);
  expect(root()).toHaveAttribute("data-ledger-clasp");
  expect(board.querySelectorAll(".ledger-page")).toHaveLength(1);
  expect(screen.getByRole("dialog")).toHaveFocus();
  advance(2800);
  expect(screen.getByRole("dialog")).toHaveAttribute("data-reveal", "complete");
  fireEvent.click(screen.getByRole("button", {name: "返回"}));
  expect(confirm).toHaveBeenCalledOnce();
});

it("withdraws without closing a dice lid", () => {
  render(<Subject mode="retreat"/>);
  advance(800);
  expect(root()).toHaveAttribute("data-ledger-veil");
  expect(root()).toHaveAttribute("data-ledger-page");
  expect(root()).not.toHaveAttribute("data-ledger-lid");
  expect(root()).not.toHaveAttribute("data-ledger-clasp");
});

it.each(["click", "Enter", " ", "Escape"])("consumes %s to skip without activating combat or claiming", input => {
  const confirm = vi.fn();
  render(<Subject confirm={confirm}/>);
  if (input === "click") fireEvent.click(screen.getByRole("button", {name: "旧行动"}));
  else fireEvent.keyDown(window, {key: input});
  expect(screen.getByRole("dialog")).toHaveAttribute("data-reveal", "instant");
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "返回"}));
  expect(confirm).toHaveBeenCalledOnce();
});

it("shows restored/reviewed receipts immediately and survives saving and retry without replay", () => {
  const confirm = vi.fn();
  const {rerender} = render(<Subject mode="direct" confirm={confirm}/>);
  const page = screen.getByRole("dialog");
  expect(page).toHaveAttribute("data-reveal", "instant");
  rerender(<Subject mode="direct" busy confirm={confirm}/>);
  expect(screen.getByRole("dialog")).toBe(page);
  expect(screen.getByRole("button", {name: "正在入账"})).toBeDisabled();
  rerender(<Subject mode="direct" error="保存失败" confirm={confirm}/>);
  expect(screen.getByRole("dialog")).toBe(page);
  expect(screen.getByRole("alert")).toHaveTextContent("保存失败");
  fireEvent.click(screen.getByRole("button", {name: "重试结算"}));
  expect(confirm).toHaveBeenCalledOnce();
});

it("finishes a live reduction immediately, without restarting when motion is enabled again", () => {
  const {rerender} = render(<Subject/>);
  advance(700);
  rerender(<Subject reduced/>);
  expect(screen.getByRole("dialog")).toHaveAttribute("data-reveal", "instant");
  rerender(<Subject/>);
  advance(4000);
  expect(screen.getByRole("dialog")).toHaveAttribute("data-reveal", "instant");
});

it("cancels old timers and starts a fresh closing for another receipt with the same outcome", () => {
  const {rerender, unmount} = render(<Subject/>);
  advance(2000);
  rerender(<Subject id="run:2"/>);
  advance(800);
  expect(root()).not.toHaveAttribute("data-ledger-page");
  expect(root()).not.toHaveAttribute("data-ledger-lid");
  rerender(<Subject active={false}/>);
  advance(5000);
  expect(root()).not.toHaveAttribute("data-ledger");
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(<Subject/>);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
