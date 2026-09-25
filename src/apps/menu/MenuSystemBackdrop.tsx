import { useLayoutEffect, useRef } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import { motionTokens } from "../../shared/ui/motion/presets";
import type { MenuView } from "./useMenuView";

/** One persistent surface for all three system sections. Its lifecycle follows
 * the home/system boundary, never a content, page or SAVE/LOAD mode clock. */
export function MenuSystemBackdrop({ displayed, target, skip }: { displayed: MenuView; target: MenuView; skip: boolean }) {
  const visible = displayed !== "home" && target !== "home";
  const opacity = useMotionValue(0);
  const boundaryTiming = useRef<{ surfaceMs: number; enterMs: number; exitMs: number }>(motionTokens.saveSlots);
  // Read timing only when crossing the boundary. Changing system sections must
  // not restart even a partially completed backdrop entrance.
  boundaryTiming.current = displayed === "save" || displayed === "load" ? motionTokens.saveSlots : motionTokens.settingsPanel;
  useLayoutEffect(() => {
    const goal = visible ? 1 : 0;
    if (skip) { opacity.set(goal); return; }
    if (opacity.get() === goal) return;
    const timing = boundaryTiming.current;
    const exitWindow = timing.surfaceMs * timing.exitMs / timing.enterMs;
    const control = animate(opacity, goal, {
      type: "tween",
      duration: Math.abs(goal - opacity.get()) * (visible ? timing.surfaceMs : exitWindow) / 1000,
      // Keep the established late fade when returning home. An interrupted
      // entrance leaves from its live alpha rather than pausing or snapping.
      delay: !visible && opacity.get() === 1 ? (timing.exitMs - exitWindow) / 1000 : 0,
      ease: visible ? [.2, .7, .2, 1] : [.8, 0, .8, .3],
    });
    return () => control.stop();
  }, [visible, skip, opacity]);
  return <motion.div className="menu-system-backdrop" aria-hidden="true" style={{ opacity }} />;
}
