import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { IndexedDbSaveSlotStore, SaveSlotConflict, type SaveSlotIndex } from "./save-slot-index";

const empty = (): SaveSlotIndex => ({ version: 1, revision: 1, slots: Array.from({ length: 30 }, () => null) });
describe("numbered slot metadata", () => {
  it("does not populate an index on read; persists thirty places across connections", async () => {
    const factory = new IDBFactory(), first = new IndexedDbSaveSlotStore(factory);
    expect(await first.read()).toBeNull();
    const index = empty(); index.slots[29] = { saveId: "save", epoch: "epoch", savedAt: "2026-09-19T10:30:00.000Z" };
    await first.compareAndSet(0, index);
    expect(await new IndexedDbSaveSlotStore(factory).read()).toEqual(index);
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
