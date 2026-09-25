import { useCallback, useEffect, useRef, useState } from "react";

type Input = {key: string; ready: boolean; blocked: boolean; boundary: boolean; suspended?: boolean; error?: unknown;
  advance: () => unknown | Promise<unknown>; reveal: () => void};
/** One playback clock; only the host's ordinary reading step is automated. */
export function useReadingPlayback(input: Input) {
  const [mode, setMode] = useState<"auto" | "skip" | null>(null), [pending, setPending] = useState(false), [failure, setFailure] = useState("");
  const latest = useRef(input); latest.current = input;
  const flight = useRef(false), attempted = useRef<string | null>(null), alive = useRef(true);
  const stop = useCallback(() => {setMode(null);}, []);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  useEffect(() => {
    const hidden = () => {if (document.hidden) stop();};
    window.addEventListener("blur", stop); document.addEventListener("visibilitychange", hidden);
    return () => {window.removeEventListener("blur", stop);document.removeEventListener("visibilitychange", hidden);};
  }, [stop]);
  useEffect(() => {
    if (input.boundary && mode === "skip") latest.current.reveal();
    if (input.boundary || input.suspended || input.error) stop();
  }, [input.boundary, input.suspended, input.error, mode, stop]);
  const run = useCallback(async (operation: () => unknown | Promise<unknown>) => {
    if (flight.current) return;
    flight.current = true; setFailure("");
    try {
      let result = operation();
      if (result && typeof (result as Promise<unknown>).then === "function") {setPending(true);result = await result;}
      if (result === null) throw Error("阅读进度未能保存，请重试。");
    }
    catch (error) {if (alive.current) {setFailure(error instanceof Error ? error.message : "阅读未能推进，请重试。"); stop();}}
    finally {flight.current = false;if (alive.current) setPending(false);}
  }, [stop]);
  useEffect(() => {
    if (!mode || input.blocked || pending || input.boundary || input.suspended || input.error || document.hidden) return;
    if (!input.ready) {if (mode === "skip") input.reveal(); return;}
    if (attempted.current === input.key) return;
    const key = input.key;
    const timer = setTimeout(() => {
      const now = latest.current;
      if (now.key !== key || now.blocked || now.boundary || now.suspended || now.error || !now.ready || flight.current) return;
      attempted.current = key; void run(now.advance);
    }, mode === "auto" ? 2200 : 16);
    return () => clearTimeout(timer);
  }, [mode, input.key, input.ready, input.blocked, input.boundary, input.suspended, input.error, pending, run]);
  function toggle(next: "auto" | "skip") {
    if (input.blocked || pending || input.boundary || input.suspended) return;
    attempted.current = null; setFailure(""); setMode(value => value === next ? null : next);
  }
  return {auto: mode === "auto", skipping: mode === "skip", pending, failure, stop, run, toggle};
}
