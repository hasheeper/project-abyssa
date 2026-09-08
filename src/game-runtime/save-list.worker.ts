import { createBrowserGameRuntime } from "./browser";

/** Only a validated, read-only directory leaves this worker; no save mutations are exposed. */
self.addEventListener("message", async (event: MessageEvent<unknown>) => {
  if (event.data !== "list") return;
  let runtime: ReturnType<typeof createBrowserGameRuntime> | undefined;
  try {
    runtime = createBrowserGameRuntime();
    self.postMessage({ type: "result", result: await runtime.application.list() });
  } catch {
    self.postMessage({ type: "error" });
  } finally { runtime?.close(); }
});
