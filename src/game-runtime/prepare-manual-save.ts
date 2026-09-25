import type { AnyGameRecord, AnyReceipt } from "../game-application";
import { MemoryGameStore } from "../game-infrastructure/storage/memory";
import type { PreparedSave } from "../game-infrastructure/storage/archive-maintenance";
import { createPlayerRuntime } from "./player-runtime";

/** Validate/import entirely in memory. The real DB sees the copy only in the
 * transaction that installs its slot and removes the replaced archive. */
export async function prepareManualSave(request: { saveId: string; epoch: string; clientRequestId: string; archive: string; format: "application" }): Promise<PreparedSave> {
  const store = new MemoryGameStore<AnyGameRecord, AnyReceipt>();
  const runtime = createPlayerRuntime(store, { newId: () => { throw new Error("Unexpected identity allocation"); }, newSeed: () => 0, close() {} });
  const result = await runtime.application.importSave(request);
  if (!result.ok) throw new Error(result.error.message);
  const record = await store.read(request.saveId);
  if (!record) throw new Error("无法准备存档副本。");
  return {record, receipt: result.receipt};
}
