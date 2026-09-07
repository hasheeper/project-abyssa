import {
  MemoryGameDatabase,
  MemoryGameStore,
} from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import type { AnyGameRecord, AnyReceipt } from "../../game-application";
import { GameSession } from "../session";
export async function manorClientFixture(seed = 19, protocolVersion: 2 | 3 | 4 = 2, itemIds?: string[]) {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(),
    store = new MemoryGameStore(database);
  let sequence = 0;
  const runtime = createPlayerRuntime(store, {
    newId: () => `request-${++sequence}`,
    newSeed: () => seed,
    close() {},
  });
  const created = await runtime.application.create({
    profileId: runtime.defaultCreation.profileId,
    ...(protocolVersion === 4 ? {contentVersion: 3} : {}),
    protocolVersion,
    saveId: "manor-save",
    epoch: "epoch",
    clientRequestId: "create",
  });
  if (!created.ok) throw new Error(created.error.message);
  const values = new Map<string, string>();
  const storage = {
    getItem: (id: string) => values.get(id) ?? null,
    setItem: (id: string, v: string) => {
      values.set(id, v);
    },
    removeItem: (id: string) => {
      values.delete(id);
    },
  };
  const session = new GameSession(
    runtime,
    { saveId: "manor-save", epoch: "epoch", expeditionId: "manor-run" },
    storage,
  );
  await session.refresh();
  const view = runtime.queries.journey(session.getSnapshot().record!)!;
  await session.dispatch({
    type: "start-expedition",
    runId: "manor-run",
    routeId: view.defaultRouteId,
    partyIds: view.initialParty,
    itemIds: itemIds ?? view.defaultItems,
    seed,
  });
  return { session, runtime, database, store, storage };
}
