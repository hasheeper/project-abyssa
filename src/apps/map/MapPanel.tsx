import type { ReactNode } from "react";
import { motion, useIsPresent } from "motion/react";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { MAP_FOCUS_EASE, MAP_FOCUS_MS, MAP_PANEL_EXIT_MS } from "./map-motion";

/** Full-viewport positioning plane; the authored panel keeps its own geometry. */
export function MapPanel({ kind, side, children }: { kind: "quest" | "team" | "loadout"; side?: "left" | "right"; children: ReactNode }) {
  const present = useIsPresent();
  const { reduced } = useUiMotion();
  const x = kind === "quest" ? (side === "left" ? -40 : 40) : 0;
  const y = kind === "quest" ? 0 : 28;
  return <motion.div className="map-panel-layer" data-panel={kind} data-exiting={!present || undefined}
    inert={!present} aria-hidden={!present || undefined}
    initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : x, y: reduced ? 0 : y }}
    animate={{ opacity: 1, x: 0, y: 0 }}
    exit={{ opacity: 0, x: reduced ? 0 : x / 3, y: reduced ? 0 : y / 3,
      transition: { duration: reduced ? 0 : MAP_PANEL_EXIT_MS / 1000, ease: "easeOut" } }}
    transition={{ duration: reduced ? 0 : kind === "quest" ? MAP_FOCUS_MS / 1000 : .56, ease: MAP_FOCUS_EASE }}>
    {children}
  </motion.div>;
}
