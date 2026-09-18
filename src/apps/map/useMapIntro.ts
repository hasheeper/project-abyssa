import { useRef } from "react";
import { usePageUiIntro } from "../../shared/transition/usePageUiIntro";
import { MAP_INTRO_DURATION_MS } from "./map-landmark-intro";

const keys = ["Tab", "Enter", " ", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

/** Keep real map readiness and the landmark score local; share only UI lifecycle. */
export function useMapIntro(sceneReady: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const intro = usePageUiIntro({ ref, ready: sceneReady, durationMs: MAP_INTRO_DURATION_MS, keys, settleOnFocus: true });
  return { ref, ...intro };
}
