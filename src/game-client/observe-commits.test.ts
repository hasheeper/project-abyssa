import { afterEach, expect, it, vi } from "vitest";
import { observeCommits } from "./observe-commits";

afterEach(() => vi.unstubAllGlobals());

it("does not duplicate initial hydration, coalesces restore events, and keeps commits arriving during a read", async () => {
  let channel!: {onmessage: ((event:{data:unknown})=>void) | null};
  vi.stubGlobal("BroadcastChannel", class {
    onmessage = null; constructor() {channel = this;} close() {} postMessage() {}
  });
  let release!: () => void;
  const refresh = vi.fn(() => new Promise<void>(resolve => {release = resolve;}));
  const observer = observeCommits({saveId:"save",epoch:"epoch"},refresh);
  window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:false}));
  await Promise.resolve();
  expect(refresh).not.toHaveBeenCalled();
  window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}));
  document.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();
  expect(refresh).toHaveBeenCalledTimes(1);
  channel.onmessage?.({data:{saveId:"other",epoch:"epoch"}});
  channel.onmessage?.({data:{saveId:"save",epoch:"epoch",revision:2}});
  release();
  await Promise.resolve(); await Promise.resolve();
  expect(refresh).toHaveBeenCalledTimes(2);
  release(); await Promise.resolve();
  document.dispatchEvent(new Event("visibilitychange"));
  observer.close(); await Promise.resolve();
  expect(refresh).toHaveBeenCalledTimes(2);
});
