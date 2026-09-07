import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { usePresentationQueue } from "./usePresentationQueue";
describe("presentation cancellation", () => {
  it.each(["cancel", "unmount"])("%s settles all waits without firing a stale continuation", async mode => {
    vi.useFakeTimers();
    const hook = renderHook(() => usePresentationQueue());
    let run = 0; act(() => { run = hook.result.current.begin()!; });
    const first = hook.result.current.wait(1000, run), second = hook.result.current.wait(2000, run);
    act(() => { if (mode === "cancel") hook.result.current.cancel(); else hook.unmount(); });
    expect(await first).toBe(false); expect(await second).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    if (mode === "cancel") hook.unmount(); vi.useRealTimers();
  });
});
