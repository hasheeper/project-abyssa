import { useRef } from "react";
import { usePageUiIntro, type PageUiIntroState } from "../../shared/transition/usePageUiIntro";

export type ShopIntroState = PageUiIntroState;
export const SHOP_INTRO_END_MS = 920;
const keys = ["Tab", "Enter", " ", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"];

/** Same visible board timing as character/map. Never spend the entrance under
 * the route curtain, and never replay it for stock or selection updates. */
export function useShopIntro() {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the original end (last child at 860ms) and paging-key fast-forward.
  const intro = usePageUiIntro({ ref, durationMs: SHOP_INTRO_END_MS, keys, settleOnFocus: true });
  return { ref, ...intro };
}
