import { IndexedDbGameStore } from "../game-infrastructure/storage/indexeddb";
import { prepareBrowserSaveHints } from "../game-infrastructure/storage/save-generation";
import { createPlayerRuntime } from "./player-runtime";
import type { AnyGameRecord, AnyReceipt } from "../game-application";
export function createBrowserGameRuntime(databaseName = "abyssa-game-v1") {
  if (databaseName === "abyssa-game-v1") prepareBrowserSaveHints();
  const store = new IndexedDbGameStore<AnyGameRecord, AnyReceipt>(databaseName);
  return createPlayerRuntime(store, { newId: () => crypto.randomUUID(), newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0], close: () => store.close() });
}
