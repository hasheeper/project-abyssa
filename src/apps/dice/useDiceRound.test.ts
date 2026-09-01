import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RealtimeDecision,
  RealtimeDecisionInput,
} from "./runtime/dice-runtime";
import { useDiceRound } from "./useDiceRound";

function createRoundOptions(
  decideRealtime = vi.fn(
    async (
      _input: RealtimeDecisionInput,
    ): Promise<RealtimeDecision | null> => null,
  ),
) {
  return {
    say: vi.fn(),
    showBanner: vi.fn(),
    transferCoins: vi.fn(),
    clearCoinTransfer: vi.fn(),
    resetReport: vi.fn(),
    decideRealtime,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useDiceRound lifecycle", () => {
  it("cancels the opening chain before starting a replacement hand", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const options = createRoundOptions();
    const { result, unmount } = renderHook(() => useDiceRound(options));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(options.resetReport).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.dealNextHand();
    });
    expect(result.current.game.handNumber).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    const openingStreets = options.showBanner.mock.calls.filter(
      ([title]) => title === "初押",
    );
    expect(openingStreets).toHaveLength(1);
    expect(options.resetReport).toHaveBeenCalledTimes(2);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a stale Runtime decision after a replacement hand reaches the same actor", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    let resolveOldDecision:
      | ((decision: RealtimeDecision | null) => void)
      | undefined;
    const oldDecision = new Promise<RealtimeDecision | null>((resolve) => {
      resolveOldDecision = resolve;
    });
    let decisionCall = 0;
    const decideRealtime = vi.fn(
      (_input: RealtimeDecisionInput): Promise<RealtimeDecision | null> => {
        decisionCall += 1;
        return decisionCall === 1 ? oldDecision : Promise.resolve(null);
      },
    );
    const options = createRoundOptions(decideRealtime);
    const { result, unmount } = renderHook(() => useDiceRound(options));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });
    expect(result.current.game.betting?.actor).toBe("player");

    let oldOpponentTurn: Promise<void> | undefined;
    act(() => {
      oldOpponentTurn = result.current.processBetAction("player", "check");
    });
    expect(decideRealtime).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    act(() => {
      result.current.dealNextHand();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.game.handNumber).toBe(2);
    expect(result.current.game.betting?.actor).toBe("opponent");
    expect(decideRealtime).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveOldDecision?.({
        action: "raise-big",
        mood: "serious",
        line: "陈旧回应",
      });
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
      await oldOpponentTurn;
    });

    expect(
      options.say.mock.calls.some(([source]) => source === "陈旧回应"),
    ).toBe(false);
    expect(result.current.game.betting?.lastAction).toBeNull();

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("prevents pending round callbacks from firing after unmount", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const options = createRoundOptions();
    const { unmount } = renderHook(() => useDiceRound(options));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    const bannerCalls = options.showBanner.mock.calls.length;
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(options.showBanner).toHaveBeenCalledTimes(bannerCalls);
  });
});
