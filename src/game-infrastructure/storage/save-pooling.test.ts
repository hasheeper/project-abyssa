import { webcrypto } from "node:crypto";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { GAME_DATABASE, GAME_DATABASE_VERSION, openGameDatabase } from "./game-database";
import { IndexedDbGameStore } from "./indexeddb";
import { IndexedDbArchiveStore } from "./archive-maintenance";
import { IndexedDbSaveSlotStore } from "./save-slot-index";
import { createConnectionVault } from "../airp-direct/connection-vault";
import type { StoredRecord, StoredReceipt } from "../../game-application/contracts";
import { isPooledJson } from "../../game-core/contracts/pooled-json";
import { clearRetiredSaveHints } from "./save-generation";

afterEach(() => vi.restoreAllMocks());
type TestRecord = StoredRecord & {frames: {text: string}[]};
const candidate = (id = "fresh") => ({schemaVersion: 4, head: {saveId: id, epoch: "one", revision: 0},
  contentRef: {catalogId: "test", contentVersion: 24, rulesVersion: 4, digest: "test"}, commits: [], frames: Array.from({length: 5}, () => ({text: "完整角色卡\n".repeat(110_000)}))} satisfies TestRecord);
function proposal(value = candidate()) {
  const {head} = value, requestId = "create", fingerprint = "fingerprint";
  const receipt: StoredReceipt = {version: 4, saveId: head.saveId, epoch: head.epoch, requestId, fingerprint, contentRef: value.contentRef,
    status: "committed", before: null, after: head, error: null, events: [], factIds: []};
  // Storage transport test: domain validation is covered by the real S4 replay.
  value.commits = [{ref: head, previous: null, requestId, kind: "create", factIds: []}] as never[];
  return {saveId: head.saveId, epoch: head.epoch, requestId, fingerprint, expectedHead: null, candidate: value, receipt};
}
async function getAll(factory: IDBFactory, name: string, store: string) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {const r = factory.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);});
  try {return await new Promise<unknown[]>((resolve, reject) => {const tx = db.transaction(store), r = tx.objectStore(store).getAll(); tx.oncomplete = () => resolve(r.result); tx.onabort = () => reject(tx.error);});}
  finally {db.close();}
}
it("persists pooled bytes, restores exact independent frames and replays lost acknowledgements", async () => {
  const factory = new IDBFactory(), store = new IndexedDbGameStore<TestRecord, StoredReceipt>(GAME_DATABASE, factory), p = proposal();
  expect((await store.commit(p)).receipt.status).toBe("committed");
  const [disk] = await getAll(factory, GAME_DATABASE, "saves");
  expect(isPooledJson(disk)).toBe(true);
  expect(JSON.stringify(disk).length).toBeLessThan(JSON.stringify(p.candidate).length / 3);
  const restored = (await store.read("fresh"))!; expect(restored).toEqual(p.candidate);
  restored.frames[0].text = "local mutation"; expect(restored.frames[1].text).toBe(p.candidate.frames[1].text);
  expect((await store.commit(p)).replayed).toBe(true);
  expect(await store.read("fresh")).toEqual(p.candidate);
  const changed = proposal(); changed.requestId = "racer"; changed.receipt.requestId = "racer";
  expect((await store.commit(changed)).receipt.status).toBe("rejected");
  expect(await store.read("fresh")).toEqual(p.candidate); store.close();
});
it("aborts pooled save and receipt together, then retries without a partial write", async () => {
  const factory = new IDBFactory(), store = new IndexedDbGameStore<TestRecord, StoredReceipt>(GAME_DATABASE, factory), p = proposal();
  const original = IDBObjectStore.prototype.put;
  const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === "receipts") throw new DOMException("test quota", "QuotaExceededError");
    return original.apply(this, args);
  });
  await expect(store.commit(p)).rejects.toThrow("test quota"); expect(await store.read("fresh")).toBeNull();
  expect(await store.receipt("fresh", "one", "create")).toBeNull(); spy.mockRestore();
  expect((await store.commit(p)).receipt.status).toBe("committed"); store.close();
});
it("supports exact-head deletion/replacement and retry of pooled manual saves", async () => {
  const factory = new IDBFactory(), store = new IndexedDbGameStore<TestRecord, StoredReceipt>(GAME_DATABASE, factory), p = proposal();
  await store.commit(p);
  const archive = new IndexedDbArchiveStore(factory), target = await archive.inspect("fresh", p.candidate.head), n = proposal(candidate("replacement"));
  const index = {version: 1 as const, revision: 0, slots: Array.from({length: 30}, (_, i) => i === 0 ? {saveId: "fresh", epoch: "one", savedAt: null} : null)};
  const change = {index, target, replacement: {position: 0, savedAt: "2026-09-25T00:00:00Z", save: {record: n.candidate, receipt: n.receipt}}};
  const result = await archive.change(change); expect(await archive.change(change)).toEqual(result);
  expect(await store.read("fresh")).toBeNull(); expect(await store.read("replacement")).toEqual(n.candidate); store.close();
});
it.each([1, 2])("clears old default v%s game records exactly once and retains the independent API vault", async version => {
  const factory = new IDBFactory(), vault = createConnectionVault({indexedDB: factory, crypto: webcrypto as unknown as Crypto});
  await vault.write("test-only-config");
  const old = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = factory.open(GAME_DATABASE, version);
    r.onupgradeneeded = () => {for (const name of ["saves", "receipts", "archive", "unrelated"]) r.result.createObjectStore(name);};
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  await new Promise<void>(resolve => {const tx = old.transaction(["saves", "receipts", "archive", "unrelated"], "readwrite"); for (const name of ["saves", "receipts", "archive", "unrelated"]) tx.objectStore(name).put("old", "old"); tx.oncomplete = () => resolve();}); old.close();
  const db = await openGameDatabase(factory); expect(db.version).toBe(GAME_DATABASE_VERSION); db.close();
  for (const name of ["saves", "receipts", "archive"]) expect(await getAll(factory, GAME_DATABASE, name)).toEqual([]);
  expect(await getAll(factory, GAME_DATABASE, "unrelated")).toEqual(["old"]); expect(await vault.read()).toBe("test-only-config");
  const store = new IndexedDbGameStore<TestRecord, StoredReceipt>(GAME_DATABASE, factory), p = proposal(); await store.commit(p); store.close();
  const again = await openGameDatabase(factory); again.close();
  expect(await new IndexedDbSaveSlotStore(factory).read()).toBeNull();
  expect(await store.read("fresh")).toEqual(p.candidate); store.close();
});
it("clears only retired save hints once, retaining preferences and new-generation progress", () => {
  const map = new Map([["abyssa:recent-save:v1", "old"], ["abyssa:pending:v4:old:one", "old"], ["abyssa.ai-connection.v1", "keep"], ["volume", ".4"]]);
  const storage = {getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => {map.set(k, v);}, removeItem: (k: string) => {map.delete(k);}, key: (i: number) => [...map.keys()][i], get length() {return map.size;}} as Storage;
  clearRetiredSaveHints(storage); expect(map.has("abyssa:recent-save:v1")).toBe(false); expect(map.has("abyssa:pending:v4:old:one")).toBe(false);
  expect(map.get("abyssa.ai-connection.v1")).toBe("keep"); expect(map.get("volume")).toBe(".4");
  map.set("abyssa:recent-save:v1", "new"); clearRetiredSaveHints(storage); expect(map.get("abyssa:recent-save:v1")).toBe("new");
});
