import type { SaveLocator } from "./navigation";

/** Shared invalidation only. Each session decides whether it may execute commands. */
export function observeCommits(
  locator: SaveLocator,
  refresh: () => Promise<void>,
) {
  const channel =
    typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel("abyssa:commits:v1");
  let closed = false, scheduled = false, running = false, dirty = false;
  const visible = () => {
    if (closed || document.visibilityState === "hidden") return;
    dirty = true;
    if (scheduled || running) return;
    scheduled = true;
    queueMicrotask(async () => {
      scheduled = false;
      if (closed || document.visibilityState === "hidden") return;
      dirty = false;
      running = true;
      try { await refresh(); }
      finally {
        running = false;
        // A commit arriving during a read still requires one follow-up read.
        if (dirty) visible();
      }
    });
  };
  // Initial hydration belongs to the provider. Only a bfcache restoration
  // needs pageshow revalidation; ordinary pageshow used to duplicate that load.
  const restored = (event: PageTransitionEvent) => { if (event.persisted) visible(); };
  if (channel)
    channel.onmessage = (event) => {
      if (
        event.data?.saveId === locator.saveId &&
        event.data?.epoch === locator.epoch
      )
        visible();
    };
  window.addEventListener("pageshow", restored);
  document.addEventListener("visibilitychange", visible);
  return {
    notify: (head: { saveId: string; epoch: string; revision: number }) =>
      channel?.postMessage(head),
    close() {
      closed = true;
      channel?.close();
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visible);
    },
  };
}
