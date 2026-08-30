import { useCallback, useEffect, useRef, useState } from "react";

export function usePresentationQueue() {
  const runRef = useRef(0);
  const busyRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const [busy, setBusy] = useState(false);

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  const begin = useCallback((): number | null => {
    if (busyRef.current) return null;
    const runId = ++runRef.current;
    busyRef.current = true;
    setBusy(true);
    return runId;
  }, []);

  const wait = useCallback((duration: number, runId: number) =>
    new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        timersRef.current = timersRef.current.filter(
          (activeTimer) => activeTimer !== timer
        );
        resolve(runRef.current === runId);
      }, duration);
      timersRef.current.push(timer);
    }), []);

  const complete = useCallback((runId: number) => {
    if (runRef.current !== runId) return;
    busyRef.current = false;
    setBusy(false);
  }, []);

  const cancel = useCallback(() => {
    runRef.current += 1;
    busyRef.current = false;
    clearTimers();
    setBusy(false);
  }, [clearTimers]);

  const isBusy = useCallback(() => busyRef.current, []);
  const isCurrent = useCallback((runId: number) => runRef.current === runId, []);

  useEffect(() => () => {
    runRef.current += 1;
    busyRef.current = false;
    clearTimers();
  }, [clearTimers]);

  return { busy, begin, wait, complete, cancel, isBusy, isCurrent };
}
