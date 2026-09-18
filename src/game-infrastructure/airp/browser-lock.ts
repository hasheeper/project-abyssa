/** Same-origin browser coordination only. This does not claim cross-device or backend uniqueness. */
export async function withAirpBrowserLock<T>(key: string, signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) throw Object.assign(new Error("AIRP_BROWSER_LOCK_UNAVAILABLE"), { code: "AIRP_BROWSER_LOCK_UNAVAILABLE" });
  return navigator.locks.request(key, { mode: "exclusive", signal }, async () => { signal.throwIfAborted(); return run(); });
}
