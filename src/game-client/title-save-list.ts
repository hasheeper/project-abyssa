import type { createBrowserGameRuntime } from "../game-runtime/browser";

export type TitleSaveList = Awaited<ReturnType<ReturnType<typeof createBrowserGameRuntime>["application"]["list"]>>;
const aborted = () => new DOMException("Archive reading cancelled", "AbortError");

/** Full receipt/catalog validation stays intact, but runs outside the title animation thread. */
export async function readTitleSaveList(signal: AbortSignal): Promise<TitleSaveList> {
  if (signal.aborted) throw aborted();
  // Non-worker hosts (including DOM tests) keep the existing validated reader.
  if (typeof Worker === "undefined") {
    const { createBrowserGameRuntime } = await import("../game-runtime/browser");
    if (signal.aborted) throw aborted();
    const runtime = createBrowserGameRuntime();
    try {
      const result = await runtime.application.list();
      if (signal.aborted) throw aborted();
      return result;
    } finally { runtime.close(); }
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../game-runtime/save-list.worker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const finish = (error?: Error, result?: TitleSaveList) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate();
      if (error) reject(error); else resolve(result!);
    };
    const cancel = () => finish(aborted());
    const timeout = setTimeout(() => finish(new Error("Archive reader timed out")), 30_000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = event => event.data?.type === "result"
      ? finish(undefined, event.data.result)
      : finish(new Error("Archive worker unavailable"));
    worker.onerror = event => { event.preventDefault(); finish(new Error("Archive worker unavailable")); };
    worker.onmessageerror = () => finish(new Error("Archive response unreadable"));
    try { worker.postMessage("list"); }
    catch (error) { finish(error instanceof Error ? error : new Error("Archive worker unavailable")); }
  });
}
