import { describe, expect, it, vi } from "vitest";
import { createManualSaveAttempt } from "./manual-save";
import { newGameFixture } from "./testing/new-game";

async function fixture() {
  const f = newGameFixture();
  const created = await f.runtime.application.createNewGame({ saveId: "source", epoch: "epoch", clientRequestId: "create", startAt: "hub", playerName: "测试旅人" });
  if (!created.ok) throw new Error(created.error.message);
  const loaded = await f.runtime.application.open("source");
  if (!loaded.ok) throw new Error(loaded.error.message);
  return { ...f, source: loaded.record };
}

describe("manual local save", () => {
  it("creates a validated copy of current chapter-one progress without changing or selecting the original", async () => {
    const { runtime, store, source } = await fixture();
    const attempt = createManualSaveAttempt(runtime, source);
    expect(await store.listSaveIds()).toEqual(["source"]);
    const a = attempt.save(), b = attempt.save();
    expect(a).toBe(b);
    const locator = await a;
    expect(attempt.completed).toBe(true);
    expect(await attempt.save()).toEqual(locator);
    expect(await store.listSaveIds()).toHaveLength(2);
    const copied = await runtime.application.open(locator.saveId);
    if (!copied.ok) throw new Error(copied.error.message);
    expect(copied.record.head.epoch).toBe(locator.epoch);
    expect(copied.record.snapshot.campaign).toEqual(source.snapshot.campaign);
    expect(copied.record.contentRef).toEqual(source.contentRef);
    expect(await runtime.application.open("source")).toEqual({ ok: true, record: source });
  });

  it("reuses the request after an ambiguous commit failure, creating only one copy", async () => {
    const { runtime, store, source } = await fixture();
    const original = runtime.application.importSave.bind(runtime.application);
    const importSave = vi.spyOn(runtime.application, "importSave").mockImplementationOnce(async request => {
      await original(request); throw new Error("transport interrupted after commit");
    });
    const attempt = createManualSaveAttempt(runtime, source);
    await expect(attempt.save()).rejects.toThrow("interrupted");
    const first = importSave.mock.calls[0][0];
    const locator = await attempt.save();
    expect(importSave.mock.calls[1][0]).toEqual(first);
    expect(await store.listSaveIds()).toHaveLength(2);
    expect((await runtime.application.open(locator.saveId)).ok).toBe(true);
  });

  it("refuses to save a different head than the progress the player previewed", async () => {
    const { runtime, store, source } = await fixture();
    const attempt = createManualSaveAttempt(runtime, { ...source, head: { ...source.head, revision: source.head.revision + 1 } });
    await expect(attempt.save()).rejects.toThrow("另一页面改变");
    expect(await store.listSaveIds()).toEqual(["source"]);
  });

  it("reports storage errors without claiming that a manual save exists", async () => {
    const { runtime, store, source } = await fixture();
    vi.spyOn(runtime.application, "importSave").mockResolvedValueOnce({ ok: false, error: { code: "storage-quota", path: "store", message: "full" } });
    const attempt = createManualSaveAttempt(runtime, source);
    await expect(attempt.save()).rejects.toThrow("存储空间不足");
    expect(attempt.completed).toBe(false);
    expect(await store.listSaveIds()).toEqual(["source"]);
    await expect(attempt.save()).resolves.toHaveProperty("saveId");
  });
});
