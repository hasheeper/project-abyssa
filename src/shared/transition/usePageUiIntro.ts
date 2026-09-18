import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useUiMotion } from "../ui/motion/UiMotionProvider";
import { SceneTransitionContext } from "./TransitionProvider";

export type PageUiIntroState = "waiting" | "playing" | "ready";

interface PageUiIntroOptions {
  ref: RefObject<HTMLElement | null>;
  durationMs: number;
  /** Actual page readiness, never a timeout or a replacement for asset checks. */
  ready?: boolean;
  suspended?: boolean;
  /** Keep this page-owned key list stable across renders. */
  keys: readonly string[];
  settleOnFocus: boolean;
  /** Only needed when chrome is a sibling of the referenced scene viewport. */
  inputRootSelector?: string;
}

/** One visible UI entrance per mount. No animation engine, DOM wrapper or RAF. */
export function usePageUiIntro({ ref, durationMs, ready = true, suspended = false,
  keys, settleOnFocus, inputRootSelector }: PageUiIntroOptions) {
  const phase = useContext(SceneTransitionContext)?.phase ?? "idle";
  const { reduced } = useUiMotion();
  const started = useRef(false);
  const [state, setState] = useState<PageUiIntroState>("waiting");
  const finish = useCallback(() => setState("ready"), []);
  const canStart = ready && !suspended && phase === "idle";

  useLayoutEffect(() => {
    if (!started.current && canStart) {
      started.current = true;
      setState(reduced || document.hidden ? "ready" : "playing");
    } else if (started.current && (reduced || suspended || phase === "closing" || phase === "closed")) {
      finish();
    }
  }, [canStart, phase, reduced, suspended, finish]);

  useEffect(() => {
    if (state !== "playing") return;
    // The page owns the end of its complete score, not just the board preset.
    const timer = window.setTimeout(finish, durationMs);
    const hidden = () => { if (document.hidden) finish(); };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [state, durationMs, finish]);

  useEffect(() => {
    const element = ref.current;
    const root = inputRootSelector ? element?.closest<HTMLElement>(inputRootSelector) ?? element : element;
    if (!root || state === "ready") return;
    // Settle before the existing business handler, without consuming its event.
    const complete = () => { if (canStart) flushSync(finish); };
    const pointer = (event: PointerEvent) => { if (event.button === 0) complete(); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (event.target !== document.body && !(event.target instanceof Node && root.contains(event.target))) return;
      if (keys.includes(event.key)) complete();
    };
    root.addEventListener("pointerdown", pointer, true);
    root.addEventListener("click", complete, true);
    if (settleOnFocus) root.addEventListener("focusin", complete, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      root.removeEventListener("pointerdown", pointer, true);
      root.removeEventListener("click", complete, true);
      if (settleOnFocus) root.removeEventListener("focusin", complete, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [ref, inputRootSelector, canStart, keys, settleOnFocus, state, finish]);

  return { state, reduced };
}
