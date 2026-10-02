import { fetchModelIds, modelsUrl } from "../game-infrastructure/airp-direct/model-list";

export type ModelListState = { status: "idle" | "loading" | "ready" | "failed"; ids: readonly string[]; error: string | null };
const idle: ModelListState = { status: "idle", ids: [], error: null };
type Entry = { state: ModelListState; controller: AbortController; promise: Promise<void> };

/** Page-local cache. Credentials identify a connection in memory, never in a public snapshot or storage. */
export function createModelListController(fetchIds = fetchModelIds) {
  const entries = new Map<string, Entry>(), listeners = new Set<() => void>();
  let revision = 0;
  const identity = (baseUrl: string, key: string) => {
    let url = baseUrl.trim();
    try { url = modelsUrl(baseUrl); } catch { /* Validate when explicitly requested. */ }
    return JSON.stringify([url, key.trim()]);
  };
  const publish = () => { revision++; listeners.forEach(listener => listener()); };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => revision,
    read(baseUrl: string, key: string): ModelListState { return entries.get(identity(baseUrl, key))?.state ?? idle; },
    async load(baseUrl: string, key: string, refresh = false) {
      const id = identity(baseUrl, key), cached = entries.get(id);
      if (cached?.state.status === "loading") return cached.promise;
      if (!refresh && cached?.state.status === "ready") return;
      const entry: Entry = { state: { status: "loading", ids: [], error: null }, controller: new AbortController(), promise: Promise.resolve() };
      entries.set(id, entry);
      entry.promise = (async () => {
        try {
          const ids = await fetchIds(baseUrl, key, entry.controller.signal);
          entry.state = { status: "ready", ids, error: null };
        } catch (error) {
          entry.state = { status: "failed", ids: [], error: error instanceof Error ? error.message : "未能获取模型列表，请重试。" };
        }
        if (entries.get(id) === entry) publish();
      })();
      publish();
      return entry.promise;
    },
    dispose() { entries.forEach(entry => entry.controller.abort()); entries.clear(); publish(); },
  };
}
export type ModelListController = ReturnType<typeof createModelListController>;
