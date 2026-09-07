/** Isolated IndexedDB assembly for the D2 browser tests. */
import { createBrowserGameReader } from "../browser-reader";
import { createVersionedGameRuntime } from "../versioned-runtime";
import { demoFixture } from "./demo-fixtures";
import { IndexedDbGameStore } from "../../game-infrastructure/storage/indexeddb";
import type { AnyGameRecord, AnyReceipt } from "../../game-application";

const database = "abyssa-d2-browser-test";
export const catalog = demoFixture((c) => {
  for (const p of Object.values(c.profiles)) {
    p.availableCharacterIds = c.initialParty;
    p.progress.equipment = [
      {
        instanceId: "test.blade",
        definitionId: "equipment.spare-blade",
        ownerId: "kororo",
      },
    ];
  }
});
const registrations = [{ version: 2 as const, catalog }];
const store = new IndexedDbGameStore<AnyGameRecord, AnyReceipt>(database);
export const runtime = createVersionedGameRuntime(store, registrations);
export const factory = () => createBrowserGameReader(database, registrations);
