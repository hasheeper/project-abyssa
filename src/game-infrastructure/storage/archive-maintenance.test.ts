import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IndexedDbArchiveStore, ArchiveConflict, type PreparedSave } from "./archive-maintenance";
import { openGameDatabase } from "./game-database";
import { IndexedDbSaveSlotStore, SaveSlotConflict, SAVE_SLOT_DATABASE, type SaveSlotIndex } from "./save-slot-index";
import { requestKey } from "../../game-application/transaction";

const copy = (id: string): PreparedSave => {
  const head = {saveId: id, epoch: "epoch", revision: 1};
  const contentRef = {catalogId: "test", contentVersion: 1, rulesVersion: 1, digest: "hash"};
  return {record: {schemaVersion: 1, head, contentRef, commits: []}, receipt: {version: 1, saveId: id, epoch: "epoch", requestId: "create",
    fingerprint: "hash", contentRef, status: "committed", before: null, after: head, error: null, events: [], factIds: []}};
};
async function fixture() {
  const factory = new IDBFactory(), store = new IndexedDbArchiveStore(factory), slots = new IndexedDbSaveSlotStore(factory);
  const old = copy("old"), keep = copy("keep"), next = copy("next");
  const db = await openGameDatabase(factory);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["saves", "receipts"], "readwrite");
    for (const save of [old, keep]) {
      tx.objectStore("saves").put(save.record, save.record.head.saveId);
      tx.objectStore("receipts").put(save.receipt, requestKey(save.receipt.saveId, "epoch", "create"));
    }
    tx.objectStore("receipts").put({...old.receipt, epoch: "older", requestId: "failed", status: "rejected"}, requestKey("old", "older", "failed"));
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  const index: SaveSlotIndex = {version: 1, revision: 0, slots: Array.from({length: 30}, (_, n) => n < 2 ? {saveId: "old", epoch: "epoch", savedAt: null} : n === 2 ? {saveId: "keep", epoch: "epoch", savedAt: null} : null)};
  const target = await store.inspect("old", old.record.head);
  const readAll = () => new Promise<{saves: unknown[]; receipts: unknown[]}>((resolve, reject) => {
    const tx = db.transaction(["saves", "receipts"], "readonly"), a = tx.objectStore("saves").getAll(), b = tx.objectStore("receipts").getAll();
    tx.oncomplete = () => resolve({saves: a.result, receipts: b.result}); tx.onabort = () => reject(tx.error);
  });
  return {factory, store, slots, db, index, old, keep, next, target, readAll};
}
afterEach(() => vi.restoreAllMocks());
describe("permanent archive transactions", () => {
  it("replaces atomically, removes all old receipts and aliases, retains unrelated saves, and retries idempotently", async () => {
    const f = await fixture();
    const change = {index: f.index, target: f.target, replacement: {position: 0, savedAt: "2026-09-20T00:00:00Z", save: f.next}};
    const result = await f.store.change(change);
    expect(result.slots[0]?.saveId).toBe("next"); expect(result.slots[1]).toBeNull(); expect(result.slots[2]?.saveId).toBe("keep");
    expect(await f.readAll()).toEqual({saves: [f.keep.record, f.next.record], receipts: [f.keep.receipt, f.next.receipt]});
    expect(await f.store.change(change)).toEqual(result);
    f.db.close();
  });
  it("deletes snapshot, receipts and every slot reference, without deleting another save", async () => {
    const f = await fixture();
    const result = await f.store.change({index: f.index, target: f.target});
    expect(result.slots.slice(0, 2)).toEqual([null, null]);
    expect(await f.readAll()).toEqual({saves: [f.keep.record], receipts: [f.keep.receipt]});
    expect(await f.store.change({index: f.index, target: f.target})).toEqual(result);
    f.db.close();
  });
  it("aborts all writes on storage failure; the new copy never becomes an orphan", async () => {
    const f = await fixture(), before = await f.readAll();
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === "archive") throw new DOMException("full", "QuotaExceededError");
      return original.apply(this, args);
    });
    await expect(f.store.change({index: f.index, target: f.target, replacement: {position: 0, savedAt: "2026-09-20T00:00:00Z", save: f.next}})).rejects.toThrow("full");
    expect(await f.readAll()).toEqual(before); expect(await f.slots.read()).toBeNull(); f.db.close();
  });
  it("refuses a newer directory and a changed target instead of deleting the winner", async () => {
    const f = await fixture(), before = await f.readAll();
    await f.slots.compareAndSet(0, {...f.index, revision: 1});
    await expect(f.store.change({index: f.index, target: f.target})).rejects.toBeInstanceOf(SaveSlotConflict);
    const index = (await f.slots.read())!;
    await new Promise<void>(resolve => { const tx = f.db.transaction("saves", "readwrite"); tx.objectStore("saves").put({...f.old.record, head: {...f.old.record.head, revision: 2}}, "old"); tx.oncomplete = () => resolve(); });
    await expect(f.store.change({index, target: f.target})).rejects.toBeInstanceOf(ArchiveConflict);
    expect((await f.readAll()).receipts).toEqual(before.receipts); f.db.close();
  });
  it("protects the currently running save", async () => {
    const f = await fixture(), before = await f.readAll();
    await expect(f.store.change({index: f.index, target: f.target, protectedSaveId: "old"})).rejects.toThrow("当前旅程");
    expect(await f.readAll()).toEqual(before); f.db.close();
  });
  it("can permanently remove an unreadable record using an exact captured value", async () => {
    const f = await fixture();
    await new Promise<void>(resolve => { const tx = f.db.transaction("saves", "readwrite"); tx.objectStore("saves").put({broken: true}, "old"); tx.oncomplete = () => resolve(); });
    const target = await f.store.inspect("old");
    await f.store.change({index: f.index, target});
    expect(await f.readAll()).toEqual({saves: [f.keep.record], receipts: [f.keep.receipt]}); f.db.close();
  });
  it("discards the retired numbering instead of resurrecting old slots after cutover", async () => {
    const f = await fixture(), legacy = {...f.index, revision: 4};
    const oldDb = await new Promise<IDBDatabase>((resolve, reject) => { const r = f.factory.open(SAVE_SLOT_DATABASE, 1); r.onupgradeneeded = () => r.result.createObjectStore("index"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>(resolve => {const tx = oldDb.transaction("index", "readwrite"); tx.objectStore("index").put(legacy, "manual"); tx.oncomplete = () => resolve();}); oldDb.close();
    expect(await f.slots.read()).toBeNull();
    const result = await f.store.change({index: f.index, target: f.target});
    expect(result.revision).toBe(1); expect(result.slots[2]).toEqual(f.index.slots[2]);
    expect(await f.slots.readLegacy()).toBeNull(); expect(await f.slots.read()).toEqual(result); f.db.close();
  });
});
