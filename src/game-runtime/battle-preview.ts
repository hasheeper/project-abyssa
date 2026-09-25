import { MemoryGameDatabase, MemoryGameStore } from "../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt } from "../game-application";
import { createPlayerRuntime } from "./player-runtime";

/** Isolated ordinary battle runtime. Uses the shipped rules/content, no browser database. */
export function createBattlePreviewRuntime(seed = 19) {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  let sequence = 0;
  return createPlayerRuntime(new MemoryGameStore(database), {
    newId: () => `preview-${++sequence}`, newSeed: () => seed,
    close() { database.records.clear(); database.receipts.clear(); },
  });
}
