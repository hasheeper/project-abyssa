import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cloneGame, createInitialGame } from "../game";
import type { GameState } from "../game";
import { useDiceSettlement } from "./useDiceSettlement";

function createGameHarness() {
  let game = createInitialGame();
  return {
    get game() {
      return game;
    },
    commit(change: (next: GameState) => void) {
      const next = cloneGame(game);
      change(next);
      game = next;
      return next;
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useDiceSettlement", () => {
  it("keeps a cancelled fold in its reveal state without opening a result", async () => {
    const harness = createGameHarness();
    const saveBattleRecord = vi.fn();
    const openResult = vi.fn();
    const showBanner = vi.fn();
    const { result } = renderHook(() =>
      useDiceSettlement({
        commit: harness.commit,
        getCurrentGame: () => harness.game,
        recordEvent: vi.fn(),
        saveBattleRecord,
        wait: vi.fn().mockResolvedValue(false),
        say: vi.fn(),
        showBanner,
        openResult,
      }),
    );

    await act(async () => {
      await result.current.settleFold("player");
    });

    expect(harness.game.phase).toBe("showdown");
    expect(harness.game.showdownRevealed).toBe(true);
    expect(harness.game.pot).toBe(30);
    expect(showBanner).toHaveBeenCalledWith(
      "你已弃牌",
      "DICE REVEALED · 5 SEC",
    );
    expect(saveBattleRecord).not.toHaveBeenCalled();
    expect(openResult).not.toHaveBeenCalled();
  });

  it("settles a completed showdown and preserves the original pot accounting", async () => {
    const harness = createGameHarness();
    const recordEvent = vi.fn();
    const saveBattleRecord = vi.fn();
    const openResult = vi.fn();
    const showBanner = vi.fn();
    const { result } = renderHook(() =>
      useDiceSettlement({
        commit: harness.commit,
        getCurrentGame: () => harness.game,
        recordEvent,
        saveBattleRecord,
        wait: vi.fn().mockResolvedValue(true),
        say: vi.fn(),
        showBanner,
        openResult,
      }),
    );

    await act(async () => {
      await result.current.settleShowdown();
    });

    expect(harness.game.phase).toBe("settled");
    expect(harness.game.winner).toBe("opponent");
    expect(harness.game.lumenPriorityWinner).toBeNull();
    expect(harness.game.settledPot).toBe(30);
    expect(harness.game.pot).toBe(0);
    expect(harness.game.bankroll).toEqual({ player: 480, opponent: 520 });
    expect(recordEvent).toHaveBeenCalledWith(
      "揭蛊：玩家1,2,3,4,5，缇比6,5,4,3,2，结果opponent",
    );
    expect(saveBattleRecord).toHaveBeenCalledWith(harness.game);
    expect(showBanner).toHaveBeenLastCalledWith(
      "缇比胜出",
      "LARGE STRAIGHT · LARGE STRAIGHT",
    );
    expect(openResult).toHaveBeenCalledTimes(1);
  });
});
