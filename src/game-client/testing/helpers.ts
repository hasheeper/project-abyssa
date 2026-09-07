import { MemoryGameStore, MemoryGameDatabase } from "../../game-infrastructure/storage/memory";
import { createGameRuntime } from "../../game-runtime/create-runtime";
import { gameContent } from "../../game-runtime/views";
import { GameSession } from "../session";
export async function clientFixture(options: { seed?: number; partyIds?: string[]; start?: boolean; database?: MemoryGameDatabase; legacyArchive?: string; initial?: unknown } = {}) {
  const database = options.database ?? new MemoryGameDatabase(), store = new MemoryGameStore(database);
  let id = 0;
  const runtime = createGameRuntime(store, { newId: () => `request-${++id}`, newSeed: () => options.seed ?? 19, close() {} });
  const identity = { protocolVersion: 1, saveId: "save", epoch: "epoch", clientRequestId: "create" };
  const create = options.legacyArchive ? await runtime.application.importSave({ ...identity, format: "legacy", archive: options.legacyArchive }) : await runtime.application.create({ ...identity, ...(options.initial !== undefined ? { initial: options.initial } : {}) });
  if (!create.ok) throw new Error(create.error.message);
  if (options.start !== false && !options.legacyArchive) {
    const opened = await runtime.application.open("save"); if (!opened.ok) throw new Error("open");
    await runtime.application.dispatch({ protocolVersion: 1, saveId: "save", expectedHead: opened.record.head, clientRequestId: "start", command: { type: "start-expedition", expeditionId: "run", routeId: gameContent.defaultRouteId, partyIds: options.partyIds ?? [...gameContent.defaultParty], itemIds: [], equipmentIds: [], seed: options.seed ?? 19 } });
  }
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const loaded = await runtime.application.open("save"); if (!loaded.ok) throw new Error("open");
  const expeditionId = loaded.record.snapshot.expedition?.id;
  const session = new GameSession(runtime, { saveId: "save", epoch: "epoch", ...(expeditionId ? { expeditionId } : {}) }, storage);
  await session.refresh();
  return { database, store, runtime, session, storage, values };
}
