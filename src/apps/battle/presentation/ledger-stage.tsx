import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { LootOutcome } from "../loot/loot-types";
import "./ledger-stage.css";

/** stow: dice go into the tray and the lid closes. retreat: an active withdrawal, veil only. direct: already settled or read. */
export type LedgerStageMode = "stow" | "retreat" | "direct";
/** A receipt presented inside the battle frame, over the closed board. */
export type BattleSettlement = { id: string; content: ReactNode; outcome: LootOutcome; mode: LedgerStageMode };

type Stage = "closing" | "lid" | "clasp" | "veil" | "page";
// The last die settles at 160 + 4×70 + 680ms and its rim at ~1200ms; the lid follows.
const TIMELINE: Record<LedgerStageMode, readonly (readonly [Stage, number])[]> = {
  stow: [["closing", 0], ["lid", 1180], ["clasp", 1780], ["veil", 2220], ["page", 2660]],
  retreat: [["closing", 0], ["veil", 340], ["page", 720]],
  direct: [["veil", 0], ["page", 0]],
};
const stagesOf = (mode: LedgerStageMode) => TIMELINE[mode].map(([stage]) => stage);

type Run = { key: string | null; reached: readonly Stage[]; instant: boolean; settled: boolean };
function begin(key: string | null, mode: LedgerStageMode | undefined, reduced: boolean): Run {
  if (!key || !mode) return { key, reached: [], instant: false, settled: false };
  if (reduced || mode === "direct") return { key, reached: stagesOf(mode), instant: true, settled: false };
  return { key, reached: [], instant: false, settled: false };
}

/** Presentation-only timeline. The receipt is committed data; skipping only drops the wait. */
export function useLedgerStageRun(settlement: BattleSettlement | undefined, reduced: boolean) {
  const mode = settlement?.mode;
  const key = settlement ? JSON.stringify([settlement.id, settlement.mode, settlement.outcome]) : null;
  const [stored, setRun] = useState<Run>(() => begin(key, mode, reduced));
  let run = stored;
  if (stored.key !== key) { run = begin(key, mode, reduced); setRun(run); }
  else if (reduced && mode && !stored.instant) { run = begin(key, mode, true); setRun(run); }
  const idle = !mode || run.instant || run.reached.length === TIMELINE[mode].length;
  // One schedule per run; stages arrive through functional updates.
  useEffect(() => {
    if (idle || !mode) return;
    const timers: number[] = [];
    // Two frames: the board must paint once with data-ledger before any stage flips.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      for (const [stage, at] of TIMELINE[mode]) timers.push(window.setTimeout(() => setRun(current =>
        current.key !== key || current.reached.includes(stage) ? current : { ...current, reached: [...current.reached, stage] }), at));
    }); });
    return () => { cancelAnimationFrame(frame); timers.forEach(clearTimeout); };
  }, [key, mode, idle]);
  // Transitions stay frozen only until the skipped end state has painted.
  useEffect(() => {
    if (!key || !run.instant || run.settled) return;
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setRun(current => current.key === key ? { ...current, settled: true } : current)); });
    return () => cancelAnimationFrame(frame);
  }, [key, run.instant, run.settled]);
  const skip = useCallback(() => setRun(current => current.key === key && mode ? { ...current, reached: stagesOf(mode), instant: true, settled: false } : current), [key, mode]);
  const pageReached = run.reached.includes("page");
  const attributes: Record<`data-${string}`, string | undefined> = settlement ? {
    "data-ledger": "",
    "data-ledger-mode": settlement.mode,
    "data-ledger-outcome": settlement.outcome,
    ...Object.fromEntries(run.reached.map(stage => [`data-ledger-${stage}`, ""])),
    "data-ledger-instant": run.instant ? "" : undefined,
    "data-ledger-settled": run.settled ? "" : undefined,
  } : {};
  return { active: !!settlement, mode, instant: run.instant, pageReached, skippable: !!settlement && !pageReached, skip, attributes };
}

type LedgerStage = { active: boolean; mode?: LedgerStageMode; instant: boolean };
const LedgerStageContext = createContext<LedgerStage>({ active: false, instant: false });
export function LedgerStageProvider({ value, children }: { value: LedgerStage; children: ReactNode }) {
  return <LedgerStageContext.Provider value={value}>{children}</LedgerStageContext.Provider>;
}
/** Lets the dice tray draw its box and the page skip its reveal after a skipped stage. */
export const useLedgerStage = () => useContext(LedgerStageContext);
