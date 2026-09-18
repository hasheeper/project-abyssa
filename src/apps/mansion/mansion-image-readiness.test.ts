import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { waitForMansionImages, waitForMansionPaint } from "./mansion-image-readiness";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function image(complete = true, decode = () => Promise.resolve()) {
  const node = document.createElement("img");
  node.src = "/test.png";
  Object.defineProperties(node, {
    complete: {get: () => complete, configurable: true},
    naturalWidth: {value: 100, configurable: true},
    naturalHeight: {value: 100, configurable: true},
    decode: {value: vi.fn(decode)}
  });
  return node;
}
function world(...images: HTMLImageElement[]) {
  const root = document.createElement("main");
  root.append(...images);
  return root;
}

it("waits for every mounted decode, even when every URL is cached", async () => {
  let finish!: () => void;
  const slow = image(true, () => new Promise<void>(resolve => { finish = resolve; }));
  const fast = image(), other = image();
  const ready = vi.fn();
  const pending = waitForMansionImages(world(fast, other, slow), new AbortController().signal).then(ready);
  await vi.advanceTimersByTimeAsync(1500);
  expect(fast.decode).toHaveBeenCalledOnce();
  expect(slow.decode).toHaveBeenCalledOnce();
  expect(ready).not.toHaveBeenCalled();
  finish();
  await pending;
  expect(ready).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("waits for two rendering opportunities separately from the decode barrier", async () => {
  const ready = vi.fn();
  const pending = waitForMansionPaint(new AbortController().signal).then(ready);
  await vi.advanceTimersByTimeAsync(17);
  expect(ready).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(34);
  await pending;
  expect(ready).toHaveBeenCalledOnce();
});

it("does not confuse a load event with a completed decode", async () => {
  let finish!: () => void;
  const delayed = image(false, () => new Promise<void>(resolve => { finish = resolve; }));
  const ready = vi.fn();
  const pending = waitForMansionImages(world(delayed), new AbortController().signal).then(ready);
  await vi.advanceTimersByTimeAsync(500);
  expect(delayed.decode).not.toHaveBeenCalled();
  delayed.dispatchEvent(new Event("load"));
  await vi.advanceTimersByTimeAsync(500);
  expect(ready).not.toHaveBeenCalled();
  finish();
  await vi.advanceTimersByTimeAsync(40);
  await pending;
  expect(ready).toHaveBeenCalledOnce();
});

it.each(["error", "decode", "empty"])("rejects %s instead of revealing a partial world", async mode => {
  const broken = image(mode !== "error", () => mode === "decode" ? Promise.reject(Error("decode")) : Promise.resolve());
  if (mode === "empty") Object.defineProperty(broken, "naturalWidth", {value: 0});
  const pending = waitForMansionImages(world(image(), broken), new AbortController().signal);
  const result = expect(pending).rejects.toThrow("mansion image unavailable");
  if (mode === "error") broken.dispatchEvent(new Event("error"));
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels listeners and pending frames on unmount, including a hung decode", async () => {
  const controller = new AbortController();
  const stalled = image(true, () => new Promise<void>(() => {}));
  const pending = waitForMansionImages(world(stalled), controller.signal);
  const result = expect(pending).rejects.toBeDefined();
  controller.abort();
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

it("times out a stalled mounted image without releasing readiness", async () => {
  const pending = waitForMansionImages(world(image(false)), new AbortController().signal, 1000);
  const result = expect(pending).rejects.toThrow("timeout");
  await vi.advanceTimersByTimeAsync(1000);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});
