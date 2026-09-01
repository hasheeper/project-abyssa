import { useCallback, useEffect, useRef } from "react";

interface PendingWait {
  timer: number;
  resolve: (active: boolean) => void;
}

export function useDiceRoundScheduler() {
  const mountedRef = useRef(true);
  const sequenceRef = useRef(0);
  const pendingWaitsRef = useRef<PendingWait[]>([]);

  const drainPendingWaits = useCallback(() => {
    const pendingWaits = pendingWaitsRef.current;
    pendingWaitsRef.current = [];
    pendingWaits.forEach((pending) => {
      window.clearTimeout(pending.timer);
      pending.resolve(false);
    });
  }, []);

  const cancelPendingWaits = useCallback(() => {
    sequenceRef.current += 1;
    drainPendingWaits();
  }, [drainPendingWaits]);

  const wait = useCallback((duration: number) => {
    const sequence = sequenceRef.current;
    return new Promise<boolean>((resolve) => {
      if (!mountedRef.current) {
        resolve(false);
        return;
      }
      const pending: PendingWait = {
        timer: 0,
        resolve,
      };
      pending.timer = window.setTimeout(() => {
        pendingWaitsRef.current = pendingWaitsRef.current.filter(
          (candidate) => candidate !== pending,
        );
        resolve(
          mountedRef.current && sequenceRef.current === sequence,
        );
      }, duration);
      pendingWaitsRef.current.push(pending);
    });
  }, []);

  const getSequence = useCallback(() => sequenceRef.current, []);
  const isSequenceActive = useCallback(
    (sequence: number) =>
      mountedRef.current && sequenceRef.current === sequence,
    [],
  );
  const isMounted = useCallback(() => mountedRef.current, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequenceRef.current += 1;
      drainPendingWaits();
    };
  }, [drainPendingWaits]);

  return {
    wait,
    cancelPendingWaits,
    getSequence,
    isSequenceActive,
    isMounted,
  };
}
