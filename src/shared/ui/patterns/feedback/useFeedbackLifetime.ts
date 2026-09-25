import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

const subscribeVisibility = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const isVisible = () => document.visibilityState !== "hidden";

/** Mounted once per presentation id. Dwell begins at the real enter completion. */
export function useFeedbackLifetime({ durationMs, ready, paused, onElapsed }: {
  durationMs: number | null;
  ready: boolean;
  paused: boolean;
  onElapsed: () => void;
}) {
  const visible = useSyncExternalStore(subscribeVisibility, isVisible, () => true);
  const remaining = useRef(durationMs);
  const elapsed = useRef(false);
  const latestElapsed = useRef(onElapsed);
  useLayoutEffect(() => { latestElapsed.current = onElapsed; }, [onElapsed]);

  useEffect(() => {
    if (!ready || paused || !visible || remaining.current === null || elapsed.current) return;
    const started = performance.now();
    const timer = window.setTimeout(() => {
      elapsed.current = true;
      latestElapsed.current();
    }, Math.max(0, remaining.current));
    return () => {
      window.clearTimeout(timer);
      if (remaining.current !== null) remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [ready, paused, visible]);
}
