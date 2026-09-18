import { useRef } from "react";
import { usePageUiIntro } from "../../shared/transition/usePageUiIntro";

// Last child group ends at 880ms; preserve the existing 40ms release buffer.
export const CHARACTER_INTRO_END_MS = 920;
const keys = ["Tab", "Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];

/** Local board entrance. No visit cache: reload and route return use one score. */
export function useCharacterIntro() {
  const ref = useRef<HTMLElement>(null);
  const intro = usePageUiIntro({ ref, durationMs: CHARACTER_INTRO_END_MS, keys, settleOnFocus: true });
  return { ref, ...intro };
}
