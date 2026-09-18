import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import type { AnyGameRecord, AnyReceipt } from "../../game-application";
import { GameSession } from "../session";

export function newGameFixture() {
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(db);
  let seq = 0;
  const runtime = createPlayerRuntime(store, {newId: () => `new-${++seq}`, newSeed: () => 19, close() {}});
  return {db, store, runtime};
}

export async function tutorialEntryFixture() {
  const f = newGameFixture();
  const locator = {saveId: "overview-save", epoch: "overview-epoch"};
  const result = await f.runtime.application.createNewGame({...locator, clientRequestId: "create-overview", startAt: "tutorial"});
  if (!result.ok) throw Error(result.error.message);
  const values = new Map<string, string>();
  const storage = {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {values.set(key, value);}, removeItem: (key: string) => {values.delete(key);}};
  const session = new GameSession(f.runtime, locator, storage);
  await session.refresh();
  return {...f, session, storage};
}
