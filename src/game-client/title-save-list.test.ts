import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readTitleSaveList } from "./title-save-list";

class SaveWorker {
  static latest: SaveWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { preventDefault(): void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { SaveWorker.latest = this; }
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("Worker", SaveWorker); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("title save directory worker", () => {
  it("returns validated directory results and terminates its read-only worker", async () => {
    const pending = readTitleSaveList(new AbortController().signal);
    const worker = SaveWorker.latest;
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith("list");
    const result = { ok: true, saves: [] };
    worker.onmessage!({ data: { type: "result", result } });
    await expect(pending).resolves.toEqual(result);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("terminates an interrupted scan without delivering stale results", async () => {
    const controller = new AbortController();
    const pending = readTitleSaveList(controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
    expect(SaveWorker.latest.terminate).toHaveBeenCalledOnce();
    expect(SaveWorker.latest.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("surfaces worker failures so the title can unlock and offer retry", async () => {
    const pending = readTitleSaveList(new AbortController().signal);
    SaveWorker.latest.onmessage!({ data: { type: "error" } });
    await expect(pending).rejects.toThrow("Archive worker unavailable");
    expect(SaveWorker.latest.terminate).toHaveBeenCalledOnce();
  });

  it("does not leave the title locked if the worker stops responding", async () => {
    const pending = readTitleSaveList(new AbortController().signal);
    const rejection = expect(pending).rejects.toThrow("Archive reader timed out");
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
    expect(SaveWorker.latest.terminate).toHaveBeenCalledOnce();
  });
});
