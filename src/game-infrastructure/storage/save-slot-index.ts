import { GAME_DATABASE, openGameDatabase } from "./game-database";
export const SAVE_SLOT_COUNT = 30;
export const SAVE_SLOT_DATABASE = "abyssa-save-slots-v1";
export type SaveSlotBinding = { saveId: string; epoch: string; savedAt: string | null };
export type SaveSlotIndex = { version: 1; revision: number; slots: (SaveSlotBinding | null)[] };
export interface SaveSlotStore {
  read(): Promise<SaveSlotIndex | null>;
  compareAndSet(expectedRevision: number, next: SaveSlotIndex): Promise<void>;
}
export class SaveSlotConflict extends Error {
  constructor() { super("槽位已在另一页面更新，请刷新后重新选择。"); }
}

export function validateSlotIndex(raw: unknown): SaveSlotIndex {
  const value = raw as SaveSlotIndex | null;
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Array.isArray(value.slots) || value.slots.length !== SAVE_SLOT_COUNT || value.slots.some(slot => slot !== null &&
        (!slot || typeof slot.saveId !== "string" || !slot.saveId || typeof slot.epoch !== "string" || !slot.epoch ||
          (slot.savedAt !== null && (typeof slot.savedAt !== "string" || !Number.isFinite(Date.parse(slot.savedAt)))))))
    throw new Error("槽位目录无法读取，原始档案未被修改。");
  return value;
}

/** Slot writes share the save transaction. The retired pre-cutover directory
 * is discarded, never adopted into the fresh DEMO save generation. */
export class IndexedDbSaveSlotStore implements SaveSlotStore {
  constructor(private factory: IDBFactory = indexedDB, private name = GAME_DATABASE, private legacyName = SAVE_SLOT_DATABASE) {}
  private openLegacy(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(this.legacyName, 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore("index");
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error("槽位目录被其他页面占用，请关闭旧页面后重试。")); };
      request.onsuccess = () => {
        if (blocked) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }
  async readLegacy(): Promise<SaveSlotIndex | null> {
    const db = await this.openLegacy();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("index", "readonly"), request = tx.objectStore("index").get("manual");
      tx.oncomplete = () => {
        db.close();
        try { resolve(request.result === undefined ? null : validateSlotIndex(request.result)); }
        catch (error) { reject(error); }
      };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  async clearLegacy() {
    const db = await this.openLegacy();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("index", "readwrite");
      tx.objectStore("index").delete("manual");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  async read(): Promise<SaveSlotIndex | null> {
    const db = await openGameDatabase(this.factory, this.name);
    const current = await new Promise<SaveSlotIndex | null>((resolve, reject) => {
      const tx = db.transaction("archive", "readonly"), request = tx.objectStore("archive").get("manual");
      tx.oncomplete = () => {
        db.close();
        try { resolve(request.result === undefined ? null : validateSlotIndex(request.result)); }
        catch (error) { reject(error); }
      };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
    if (!current) await this.clearLegacy();
    return current;
  }
  async compareAndSet(expectedRevision: number, next: SaveSlotIndex): Promise<void> {
    validateSlotIndex(next);
    if (next.revision !== expectedRevision + 1) throw new Error("Invalid slot revision");
    const fallback = await this.read();
    const db = await openGameDatabase(this.factory, this.name);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("archive", "readwrite"), store = tx.objectStore("archive");
      let failure: unknown;
      const read = store.get("manual");
      read.onsuccess = () => {
        try {
          const prior = read.result === undefined ? fallback : validateSlotIndex(read.result);
          if ((prior?.revision ?? 0) !== expectedRevision) throw new SaveSlotConflict();
          store.put(next, "manual");
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(failure ?? tx.error); };
    });
    await this.clearLegacy().catch(() => {});
  }
}
