import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { projectRoot } from "../../config/paths.mjs";
const bundle = resolve(
  projectRoot,
  "dist/reports/s2/browser/storage-harness.js",
);
test.beforeAll(async () => {
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ["src/game-runtime/testing/storage-browser.ts"],
    outfile: bundle,
    bundle: true,
    format: "iife",
    globalName: "AbyssaStorageTest",
    platform: "browser",
    target: "es2022",
  });
});
async function load(page: Page) {
  await page.goto("/game/battle.html");
  await page.addScriptTag({ path: bundle });
}
test("IndexedDB rules2: mixed versions, atomic close, undo/import, two connections and reopen", async ({
  page,
}) => {
  await load(page);
  const summary = await page.evaluate(async () => {
    const h = (window as any).AbyssaStorageTest,
      a = new h.IndexedDbGameStore("demo-contract"),
      b = new h.IndexedDbGameStore("demo-contract");
    try {
      return await h.runDemoStoreContract(a, b);
    } finally {
      a.close();
      b.close();
    }
  });
  expect(summary.saveCount).toBe(3);
  await load(page);
  const restored = await page.evaluate(async () => {
    const h = (window as any).AbyssaStorageTest,
      store = new h.IndexedDbGameStore("demo-contract");
    const app = h.versionedApp(store),
      record = await h.demoOpened(app);
    const pending = app.queries.continuation(record),
      resumed = await app.resume(pending);
    const loaded = await h.demoOpened(app);
    store.close();
    return {
      version: loaded.schemaVersion,
      revision: record.head.revision,
      cursor: loaded.snapshot.battle.encounter.cursor,
      resumed: resumed.ok,
    };
  });
  expect(restored).toEqual({
    version: 2,
    revision: summary.revision,
    cursor: 2,
    resumed: true,
  });
});
for (const failure of ["abort", "quota"])
  test(`IndexedDB rules2: ${failure} leaves no save advance or receipt, same request retries`, async ({
    page,
  }) => {
    await load(page);
    const result = await page.evaluate(async (failure) => {
      const h = (window as any).AbyssaStorageTest,
        store = new h.IndexedDbGameStore(`demo-${failure}`),
        app = h.versionedApp(store);
      await app.create(h.demoCreation());
      const before = await h.demoOpened(app),
        input = h.demoRequest(before, h.demoStart);
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (
        ...args: Parameters<IDBObjectStore["put"]>
      ) {
        if (this.name === "receipts") {
          if (failure === "quota")
            throw new DOMException("Injected quota", "QuotaExceededError");
          const request = original.apply(this, args);
          request.onsuccess = () => this.transaction.abort();
          return request;
        }
        return original.apply(this, args);
      };
      let failed;
      try {
        failed = await app.dispatch(input);
      } finally {
        IDBObjectStore.prototype.put = original;
      }
      const unchanged =
          JSON.stringify(await h.demoOpened(app)) === JSON.stringify(before),
        receipt = await store.receipt(
          "demo",
          "epoch-demo",
          input.clientRequestId,
        );
      store.close();
      const reopened = new h.IndexedDbGameStore(`demo-${failure}`),
        retry = await h.versionedApp(reopened).dispatch(input);
      reopened.close();
      return { code: failed.error.code, unchanged, receipt, ok: retry.ok };
    }, failure);
    expect(result).toEqual({
      code: failure === "quota" ? "storage-quota" : "storage-aborted",
      unchanged: true,
      receipt: null,
      ok: true,
    });
  });
test("IndexedDB: shared contract, two connections and reopen persistence", async ({
  page,
}) => {
  await load(page);
  const summary = await page.evaluate(async () => {
    const h = (window as any).AbyssaStorageTest,
      a = new h.IndexedDbGameStore("contract"),
      b = new h.IndexedDbGameStore("contract");
    const result = await h.runStoreContract(a, b);
    a.close();
    b.close();
    return result;
  });
  expect(summary.settlements).toBe(1);
  await load(page);
  const restored = await page.evaluate(async () => {
    const h = (window as any).AbyssaStorageTest,
      store = new h.IndexedDbGameStore("contract");
    const r = await store.read("save");
    const receipt = await store.receipt("save", "epoch", "settle");
    store.close();
    return {
      head: r.head,
      ledger: r.snapshot.campaign.appliedSettlements.length,
      receipt: receipt.status,
    };
  });
  expect(restored).toMatchObject({
    head: { revision: summary.revision },
    ledger: 1,
    receipt: "committed",
  });
});
for (const failure of ["abort", "quota"])
  test(`IndexedDB: ${failure} rolls back both stores and request remains retryable`, async ({
    page,
  }) => {
    await load(page);
    const result = await page.evaluate(async (failure) => {
      const h = (window as any).AbyssaStorageTest,
        store = new h.IndexedDbGameStore(`failure-${failure}`),
        app = h.appFor(store);
      await app.create(h.creation());
      const before = await h.opened(app),
        input = h.request(before, h.startCommand);
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (
        ...args: Parameters<IDBObjectStore["put"]>
      ) {
        if (this.name === "receipts") {
          if (failure === "quota")
            throw new DOMException("Injected full disk", "QuotaExceededError");
          const written = original.apply(this, args);
          // Both put requests have succeeded; only transaction.oncomplete may publish success.
          written.onsuccess = () => this.transaction.abort();
          return written;
        }
        return original.apply(this, args);
      };
      let failed;
      try {
        failed = await app.dispatch(input);
      } finally {
        IDBObjectStore.prototype.put = original;
      }
      const unchanged =
          JSON.stringify(await h.opened(app)) === JSON.stringify(before),
        receipt = await store.receipt("save", "epoch", input.clientRequestId);
      store.close();
      const reopened = new h.IndexedDbGameStore(`failure-${failure}`),
        retry = await h.appFor(reopened).dispatch(input);
      reopened.close();
      return { failed, unchanged, receipt, retry };
    }, failure);
    expect(result.failed).toMatchObject({
      ok: false,
      error: {
        code: failure === "quota" ? "storage-quota" : "storage-aborted",
      },
    });
    expect(result.unchanged).toBe(true);
    expect(result.receipt).toBeNull();
    expect(result.retry.ok).toBe(true);
  });
test("IndexedDB: blocked upgrade is explicit and recoverable without deleting data", async ({
  page,
}) => {
  await load(page);
  const result = await page.evaluate(async () => {
    const h = (window as any).AbyssaStorageTest;
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("blocked", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("saves");
        r.result.createObjectStore("receipts");
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    // A real native version upgrade, held open by another connection, exercises onblocked.
    const factory = {
      open: (name: string) => indexedDB.open(name, 2),
    } as IDBFactory;
    const store = new h.IndexedDbGameStore("blocked", factory);
    let code = "";
    try {
      await store.read("save");
    } catch (error) {
      code = (error as any).code;
    }
    old.close();
    const result = await h.appFor(store).create(h.creation());
    store.close();
    return { code, result };
  });
  expect(result.code).toBe("storage-blocked");
  expect(result.result.ok).toBe(true);
});
test("IndexedDB: versionchange closes the old connection and preserves readable records", async ({
  page,
}) => {
  await load(page);
  const result = await page.evaluate(async () => {
    const h = (window as any).AbyssaStorageTest,
      store = new h.IndexedDbGameStore("versionchange");
    await h.appFor(store).create(h.creation());
    const newer = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("versionchange", 2);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error("adapter failed to close"));
    });
    const record = await new Promise<any>((resolve) => {
      const r = newer.transaction("saves").objectStore("saves").get("save");
      r.onsuccess = () => resolve(r.result);
    });
    newer.close();
    const result = await h.appFor(store).open("save");
    store.close();
    return { record: record.head, result };
  });
  expect(result.record.revision).toBe(0);
  expect(result.result).toMatchObject({
    ok: false,
    error: { code: "storage-unavailable" },
  });
});
