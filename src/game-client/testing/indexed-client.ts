import { clientFixture } from "./helpers";
import { IndexedDbGameStore } from "../../game-infrastructure/storage/indexeddb";
import { openGameDatabase } from "../../game-infrastructure/storage/game-database";
import { createGameRuntime } from "../../game-runtime/create-runtime";
import { GameSession } from "../session";

/** Same legacy scenario as clientFixture, in the isolated fake IndexedDB used
 * by the production slot/archive transaction instead of a disconnected map. */
export async function indexedClientFixture(options: Parameters<typeof clientFixture>[0] = {}) {
  const f = await clientFixture(options), db = await openGameDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["saves", "receipts"], "readwrite");
    for (const [key, value] of f.database.records) tx.objectStore("saves").put(value, key);
    for (const [key, value] of f.database.receipts) tx.objectStore("receipts").put(value, key);
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close(); f.session.dispose();
  const store = new IndexedDbGameStore();
  let id = 0;
  const runtime = createGameRuntime(store, {newId: () => "z-request-" + ++id, newSeed: () => options.seed ?? 19, close: () => store.close()});
  const session = new GameSession(runtime, f.session.locator, f.storage);
  await session.refresh();
  return {...f, runtime, session, store};
}
