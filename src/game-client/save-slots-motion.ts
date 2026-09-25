import { cubicBezier, type MotionValue } from "motion/react";
import { motionTokens } from "../shared/ui/motion/presets";
import { systemControlItems, prepareSystemItem, paintSystemItem } from "./system-panel-motion";
export const slotTiming = motionTokens.saveSlots;
export type SaveSlotSceneMotion = { clock: MotionValue<number>; modeOpacity?: MotionValue<number>; exiting: boolean; skip: boolean; onReady: (ready: boolean) => void };
export type SlotPagePhase = "ready" | "leaving" | "entering";
export type SlotMotionPart = "rail" | "body" | "anchor" | "chrome" | "surface" | "export";
const ease = cubicBezier(.2, .7, .2, 1);
const ramp = (ms: number, start: number, duration: number) => ease(Math.max(0, Math.min(1, (ms - start) / duration)));
/** Alternating upper/lower nodes follow the staggered physical positions. */
export const slotOrder = (position: number) => position % 5 * 2 + Math.floor(position / 5);
export function slotSceneProgress(clock: number, exiting: boolean, part: SlotMotionPart, order = 0): number {
  // One choreography, read backwards on exit: chrome → records → nodes → rails.
  // Reversing the easing too avoids an abrupt fast start on every outgoing item.
  if (exiting) return 1 - slotSceneProgress(1 - clock, false, part, order);
  const ms = clock * slotTiming.enterMs;
  if (part === "rail") return ramp(ms, order * 60, slotTiming.railEnterMs);
  if (part === "surface") return ramp(ms, 0, slotTiming.surfaceMs);
  if (part === "chrome" || part === "export") return ramp(ms, slotTiming.chromeStartMs + (part === "export" ? 4 : order) * slotTiming.chromeStaggerMs, slotTiming.chromeMs);
  const start = slotTiming.railHoldMs + order * slotTiming.staggerMs;
  return part === "anchor" ? ramp(ms, start, 150)
    : ramp(ms, start + 60, slotTiming.bodyMs);
}
export function slotPageVisibility(clock: number, phase: SlotPagePhase, part: SlotMotionPart, order = 0): number {
  // Page tabs and footer actions are navigation, not page contents. Keep them
  // visible throughout a page swap; only a whole-scene transition retires them.
  if (phase === "ready" || part === "chrome" || part === "rail" || part === "surface") return 1;
  if (phase === "leaving") return slotPageVisibility(1 - clock, "entering", part, order);
  const ms = clock * slotTiming.pageEnterMs;
  return part === "export" ? ramp(ms, 800 + order * 60, 240)
    : ramp(ms, order * 44 + (part === "body" ? 60 : 0), part === "anchor" ? 160 : 340);
}
export const slotSelectionTracks = (column: number | null) => Array.from({ length: 5 }, (_, i) => `${column === null ? 1 : i === column ? slotTiming.selectWeight : slotTiming.peerWeight}fr`).join(" ");
export const slotControlModeVisibility = (reveal: number, order: number) => ramp(reveal * 360, order * 35, 200);

type Binding = { element: HTMLElement; part: SlotMotionPart; order: number; start: number; startY?: number };
/** Only composite properties per frame. Rails are not remounted during paging.
 * Capture live visibility when reversing an interrupted scene, not a CSS restart. */
export function bindSaveSlotMotion(root: HTMLElement, exiting: boolean, initial: boolean, starts = new WeakMap<HTMLElement, { start: number; startY: number }>()) {
  const bind = (selector: string, part: SlotMotionPart) => Array.from(root.querySelectorAll<HTMLElement>(selector), (element, index): Binding => ({
    element, part, order: part === "rail" ? index : Number(element.dataset.slotOrder ?? slotOrder(index)),
    ...capture(element),
  }));
  function capture(element: HTMLElement) {
    let value = starts.get(element);
    if (!value) {
      const presence = element.style.getPropertyValue("--slot-presence");
      value = { start: initial ? 0 : Number(presence || (exiting ? 1 : 0)),
        // Browsers serialize `translate: 0 0px` as `0px` (omitted Y is zero).
        startY: initial || !presence ? 10 : Number.parseFloat(element.style.translate.split(" ")[1] ?? "0") };
      starts.set(element, value);
    }
    return value;
  }
  const bindings = [
    ...bind(".save-slots__rail", "rail"), ...bind(".save-slots__body", "body"),
    ...bind(".save-slots__anchor", "anchor"), ...bind(".save-slots__export", "export"),
    ...systemControlItems(root).map(({ element, order }): Binding => {
      prepareSystemItem(root, element);
      return { element, order, part: "chrome", ...capture(element) };
    }),
    { element: root, part: "surface" as const, order: 0, ...capture(root) },
  ];
  return (clock: number, pageClock: number, phase: SlotPagePhase, skip = false, modeReveal = 1) => {
    for (const { element, part, order, start, startY = 0 } of bindings) {
      const goal = exiting ? 0 : 1;
      const progress = skip ? 1 : slotSceneProgress(clock, exiting, part, order);
      let value = start + (goal - start) * progress;
      const page = !skip && !exiting ? slotPageVisibility(pageClock, phase, part, part === "export" ? 4 : order) : 1;
      value *= page;
      element.style.setProperty("--slot-presence", String(value));
      if (part === "rail") element.style.setProperty("--slot-rail-scale", String(value));
      else if (part === "surface") root.style.setProperty("--slot-surface-opacity", String(value));
      else if (part === "chrome") paintSystemItem(element, value * (skip ? 1 : slotControlModeVisibility(modeReveal, order)));
      else if (part === "export") element.style.setProperty("--slot-chrome-opacity", String(value));
      else {
        element.style.opacity = String(value);
        if (part === "body") {
          element.style.translate = `0 ${startY + ((exiting ? 10 : 0) - startY) * progress + (1 - page) * 10}px`;
          element.parentElement?.style.setProperty("--slot-body-opacity", String(value));
        }
      }
    }
  };
}
