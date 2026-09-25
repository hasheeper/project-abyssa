import { IndexedDbGameStore } from "../game-infrastructure/storage/indexeddb";
import { prepareBrowserSaveHints } from "../game-infrastructure/storage/save-generation";
import type { AnyGameRecord, AnyReceipt } from "../game-application";
import { createVersionedGameRuntime } from "./versioned-runtime";
import type { CatalogRegistration } from "./catalogs";
import { PLAYER_CATALOGS } from "./player-runtime";

/** Production registers only published content. Tests inject their own database and Catalog. */
export function createBrowserGameReader(
  databaseName = "abyssa-game-v1",
  registrations: CatalogRegistration[] = PLAYER_CATALOGS,
) {
  if (databaseName === "abyssa-game-v1") prepareBrowserSaveHints();
  const store = new IndexedDbGameStore<AnyGameRecord, AnyReceipt>(databaseName);
  const runtime = createVersionedGameRuntime(store, registrations);
  return {
    open: runtime.open,
    queries: runtime.queries,
    exportDiagnostic: runtime.exportDiagnostic,
    close: () => store.close(),
  };
}
