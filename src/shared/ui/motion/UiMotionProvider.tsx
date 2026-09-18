import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

export type UiMotionPreference = "system" | "reduced";
const PreferenceContext = createContext<UiMotionPreference>("system");
const query = "(prefers-reduced-motion: reduce)";
const systemSnapshot = () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches;
const serverSnapshot = () => false;
function subscribeSystem(listener: () => void) {
  const media = typeof window !== "undefined" ? window.matchMedia?.(query) : undefined;
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
}

export function useUiMotion(override?: UiMotionPreference) {
  const inherited = useContext(PreferenceContext);
  // Motion 13's hook snapshots on mount; our preference must also change live.
  const systemReduced = useSyncExternalStore(subscribeSystem, systemSnapshot, serverSnapshot);
  const preference = override ?? inherited;
  return { preference, reduced: preference === "reduced" || systemReduced === true };
}

/** No DOM wrapper and no application storage. Nested themes inherit by default. */
export function UiMotionProvider({ preference, children }: { preference?: UiMotionPreference; children: ReactNode }) {
  const { preference: effective, reduced } = useUiMotion(preference);
  return <PreferenceContext.Provider value={effective}>
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>{children}</MotionConfig>
  </PreferenceContext.Provider>;
}
