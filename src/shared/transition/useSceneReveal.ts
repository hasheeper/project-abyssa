import { useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { SceneTransitionContext } from "./TransitionProvider";
import type { SceneRevealMode } from "./types";

/** A mounted page may own its board entrance while the shared curtain only fades. */
export function useSceneReveal(mode: SceneRevealMode | undefined) {
  const request = useContext(SceneTransitionContext)?.requestReveal;
  useLayoutEffect(() => mode ? request?.(mode) : undefined, [mode, request]);
}

/** Scoped overrides disappear with their page; unrelated/legacy pages keep the default. */
export function useSceneRevealRegistry(fallback: SceneRevealMode) {
  const requests = useRef(new Map<symbol, SceneRevealMode>());
  const [override, setOverride] = useState<SceneRevealMode>();
  const mode = override ?? fallback;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const requestReveal = useCallback((next: SceneRevealMode) => {
    const key = Symbol();
    requests.current.set(key, next);
    setOverride(next);
    return () => {
      requests.current.delete(key);
      setOverride([...requests.current.values()].at(-1));
    };
  }, []);
  return {mode, modeRef, requestReveal};
}
