import { IndexedDbSaveSlotStore, SAVE_SLOT_COUNT, SaveSlotConflict, type SaveSlotBinding, type SaveSlotIndex, type SaveSlotStore } from "../game-infrastructure/storage/save-slot-index";
import type { PlayerSaveListEntry } from "./player-runtime";
import { IndexedDbArchiveStore } from "../game-infrastructure/storage/archive-maintenance";
export { ArchiveConflict } from "../game-infrastructure/storage/archive-maintenance";
export type { ArchiveTarget, ArchiveChange, PreparedSave } from "../game-infrastructure/storage/archive-maintenance";
export const browserArchiveStore = {
  inspect: (...args: Parameters<IndexedDbArchiveStore["inspect"]>) => new IndexedDbArchiveStore().inspect(...args),
  change: (...args: Parameters<IndexedDbArchiveStore["change"]>) => new IndexedDbArchiveStore().change(...args),
};
export { SAVE_SLOT_COUNT, SaveSlotConflict } from "../game-infrastructure/storage/save-slot-index";
export type { SaveSlotBinding, SaveSlotIndex, SaveSlotStore } from "../game-infrastructure/storage/save-slot-index";
export const browserSaveSlots: SaveSlotStore = {
  read: () => new IndexedDbSaveSlotStore().read(),
  compareAndSet: (revision, next) => new IndexedDbSaveSlotStore().compareAndSet(revision, next),
};

/** Old saves acquire deterministic numbered positions on first use. Nothing is
 * written just by opening a panel; replacements are permanently removed by the
 * archive transaction, while unrelated overflow remains in the directory. */
export function initialSaveSlots(saves: PlayerSaveListEntry[]): SaveSlotIndex {
  const ready = saves.filter((save): save is Extract<PlayerSaveListEntry, { status: "ready" }> => save.status === "ready")
    .sort((a, b) => a.saveId < b.saveId ? -1 : a.saveId > b.saveId ? 1 : 0);
  return { version: 1, revision: 0, slots: Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => {
    const save = ready[index];
    return save ? { saveId: save.saveId, epoch: save.summary.head.epoch, savedAt: null } : null;
  }) };
}
export function slotRecord(binding: SaveSlotBinding | null, saves: PlayerSaveListEntry[]) {
  return binding ? saves.find(save => save.saveId === binding.saveId &&
    (save.status === "unavailable" || save.summary.head.epoch === binding.epoch)) : undefined;
}
export async function writeSaveSlot(store: SaveSlotStore, index: SaveSlotIndex, position: number, binding: SaveSlotBinding) {
  if (!Number.isInteger(position) || position < 0 || position >= SAVE_SLOT_COUNT) throw new Error("Invalid slot number");
  const next: SaveSlotIndex = { ...index, revision: index.revision + 1, slots: index.slots.map((prior, i) => i === position ? binding : prior) };
  try { await store.compareAndSet(index.revision, next); }
  catch (cause) {
    // Retry an uncertain write without rejecting a binding that already committed.
    if (cause instanceof SaveSlotConflict) {
      const stored = await store.read(), current = stored?.slots[position];
      if (stored && current?.saveId === binding.saveId && current.epoch === binding.epoch && current.savedAt === binding.savedAt) return stored;
    }
    throw cause;
  }
  return next;
}
