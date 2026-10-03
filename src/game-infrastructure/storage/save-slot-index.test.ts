import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { IndexedDbSaveSlotStore, SAVE_SLOT_COUNT, SaveSlotConflict, type SaveSlotIndex } from "./save-slot-index";
import { openGameDatabase } from "./game-database";

const empty = (): SaveSlotIndex => ({ version: 1, revision: 1, slots: Array.from({ length: SAVE_SLOT_COUNT }, () => null) });
describe("numbered slot metadata", () => {
  it("does not populate an index on read; persists thirty-two places across connections", async () => {
    const factory = new IDBFactory(), first = new IndexedDbSaveSlotStore(factory);
    expect(await first.read()).toBeNull();
    const index = empty(); index.slots[31] = { saveId: "save", epoch: "epoch", savedAt: "2026-09-19T10:30:00.000Z" };
    await first.compareAndSet(0, index);
    expect(await new IndexedDbSaveSlotStore(factory).read()).toEqual(index);
  });
  it("extends an existing thirty-slot index without renumbering or overwriting its bindings", async () => {
    const factory = new IDBFactory(), store = new IndexedDbSaveSlotStore(factory);
    const old = {...empty(), revision: 7, slots: Array.from({length: 30}, () => null) as SaveSlotIndex["slots"]};
    old.slots[29] = {saveId: "old", epoch: "epoch", savedAt: null};
    const db = await openGameDatabase(factory);
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("archive", "readwrite");
      transaction.objectStore("archive").put(old, "manual");
      transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error);
    });
    const expanded = (await store.read())!;
    expect(expanded).toEqual({...old, slots: [...old.slots, null, null]});
    const updated = {...expanded, revision: 8};
    updated.slots[31] = {saveId: "new", epoch: "new-epoch", savedAt: null};
    await store.compareAndSet(7, updated);
    expect(await store.read()).toEqual(updated);
    expect((await store.read())!.slots[29]).toEqual(old.slots[29]);
    db.close();
  });
  it("atomically refuses a second tab's stale write, preserving the winner", async () => {
    const factory = new IDBFactory(), a = new IndexedDbSaveSlotStore(factory), b = new IndexedDbSaveSlotStore(factory);
    const first = empty(), second = empty();
    first.slots[0] = { saveId: "first", epoch: "epoch", savedAt: null };
    second.slots[0] = { saveId: "second", epoch: "epoch", savedAt: null };
    const results = await Promise.allSettled([a.compareAndSet(0, first), b.compareAndSet(0, second)]);
    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(results[1].status === "rejected" && results[1].reason).toBeInstanceOf(SaveSlotConflict);
    expect(await b.read()).toEqual(first);
  });
  it("rejects malformed metadata instead of treating it as empty", async () => {
    const store = new IndexedDbSaveSlotStore(new IDBFactory());
    await expect(store.compareAndSet(0, { ...empty(), slots: [] })).rejects.toThrow("无法读取");
    const bad = empty(); bad.slots[0] = { saveId: "id", epoch: "epoch", savedAt: "not a date" };
    await expect(store.compareAndSet(0, bad)).rejects.toThrow("无法读取");
    expect(await store.read()).toBeNull();
  });
});
