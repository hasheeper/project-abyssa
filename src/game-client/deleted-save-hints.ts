import type { ArchiveTarget } from "../game-runtime/save-slots";
import { readSaveArchive, writeSaveArchive } from "./save-archive";

/** Remove hints only for the exact deleted ID. Never clear unrelated games,
 * preferences, narrative sources or exported files. Other tabs clear their own
 * session hints when they receive the deletion notification. */
export function clearDeletedSaveHints(saveId: string) {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const keys = Array.from({length: storage.length}, (_, i) => storage.key(i)).filter((key): key is string => !!key && key.startsWith("abyssa:"));
      for (const key of keys) {
        if (key === "abyssa:archived-saves:v1") continue;
        try {
          const value = JSON.parse(storage.getItem(key) ?? "null");
          if (value?.saveId === saveId || value?.expectedHead?.saveId === saveId) storage.removeItem(key);
        } catch { /* Not a save identity hint. */ }
      }
    } catch { /* The authoritative IndexedDB transaction already committed. */ }
  }
  try { writeSaveArchive(localStorage, readSaveArchive(localStorage).filter(e => e.head.saveId !== saveId && e.successor.saveId !== saveId)); } catch { /* Optional metadata. */ }
}

export function announceDeletedSave(target: ArchiveTarget) {
  try {
    clearDeletedSaveHints(target.saveId);
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("abyssa:commits:v1");
    channel.postMessage({ saveId: target.saveId, epoch: target.head?.epoch, deleted: true });
    channel.close();
  } catch { /* Optional hints must never turn a committed deletion into failure. */ }
}
