import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDiceRoundScheduler } from "./useDiceRoundScheduler";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useDiceRoundScheduler", () => {
  it("resolves an active wait only when its exact duration elapses", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDiceRoundScheduler());
    let resolution: boolean | undefined;
    const pending = result.current.wait(500).then((active) => {
      resolution = active;
      return active;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(resolution).toBeUndefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await expect(pending).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("invalidates the current sequence and resolves pending waits as cancelled", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDiceRoundScheduler());
    const sequence = result.current.getSequence();
    const pending = result.current.wait(5000);

    act(() => {
      result.current.cancelPendingWaits();
    });

    await expect(pending).resolves.toBe(false);
    expect(result.current.isSequenceActive(sequence)).toBe(false);
    expect(result.current.getSequence()).toBe(sequence + 1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("drains every wait when its owner unmounts", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useDiceRoundScheduler());
    const first = result.current.wait(1000);
    const second = result.current.wait(2000);
    expect(vi.getTimerCount()).toBe(2);

    unmount();

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
