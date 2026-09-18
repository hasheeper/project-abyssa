import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";

// Every route mount uses the same layered entrance, whether it follows a
// reload or an in-game return. Keep the endpoint in sync with menu-motion.css.
const timing = { speech: 1100, end: 1360 } as const;
type IntroState = "waiting" | "playing" | "ready";

export function useMenuIntro(phase: SceneTransitionPhase) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<IntroState>("waiting");
  const [speechReady, setSpeechReady] = useState(false);
  const { reduced: reducedMotion } = useUiMotion();
  const started = useRef(false);
  const finish = useCallback(() => {
    setState("ready");
    setSpeechReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!started.current && (phase === "opening" || phase === "idle")) {
      started.current = true;
      if (reducedMotion || document.hidden) finish();
      else setState("playing");
    } else if (started.current && (reducedMotion || phase === "closing" || phase === "closed")) {
      finish();
    }
  }, [phase, reducedMotion, finish]);

  // Do not depend on the curtain phase: opening -> idle must not restart or
  // cancel this local timeline. Cleanup also handles StrictMode and departure.
  useEffect(() => {
    if (state !== "playing") return;
    const speech = window.setTimeout(() => setSpeechReady(true), timing.speech);
    const end = window.setTimeout(finish, timing.end);
    const hidden = () => { if (document.hidden) finish(); };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearTimeout(speech);
      window.clearTimeout(end);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [state, finish]);

  useEffect(() => {
    const root = ref.current;
    if (!root || state === "ready") return;
    const complete = () => {
      if (phase === "idle") flushSync(finish);
    };
    const pointer = (event: PointerEvent) => { if (event.button === 0) complete(); };
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (target !== document.body && !(target instanceof Node && root.contains(target))) return;
      if (["Tab", "Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) complete();
    };
    // Finish before native focus or click dispatch, preserving the existing
    // select-then-activate contract and avoiding invisible/shifted hit targets.
    root.addEventListener("pointerdown", pointer, true);
    root.addEventListener("click", complete, true);
    root.addEventListener("focusin", complete, true);
    document.addEventListener("keydown", key, true);
    return () => {
      root.removeEventListener("pointerdown", pointer, true);
      root.removeEventListener("click", complete, true);
      root.removeEventListener("focusin", complete, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [phase, state, finish]);

  return {
    ref, state, speechReady, reducedMotion,
    blocked: phase !== "idle"
  };
}
