import type { RefObject } from "react";
import { usePageUiIntro } from "../../shared/transition/usePageUiIntro";

// Last CSS group ends at 960ms; release its compositor layers afterwards.
export const MANSION_UI_INTRO_MS = 1000;
const keys = ["Tab", "Enter", " ", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

/** UI only. Neither the world camera nor the saved clock belongs to this score. */
export function useMansionIntro(sceneReady: boolean, suspended: boolean, sceneRef: RefObject<HTMLElement | null>) {
  return usePageUiIntro({
    ref: sceneRef, ready: sceneReady, suspended, durationMs: MANSION_UI_INTRO_MS, keys,
    // Dialog autofocus must not settle the entrance; chrome is outside the viewport.
    settleOnFocus: false, inputRootSelector: ".mansion-app",
  }).state;
}
