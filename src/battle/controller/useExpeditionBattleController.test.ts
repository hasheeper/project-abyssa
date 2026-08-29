import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useExpeditionBattleController } from "./useExpeditionBattleController";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Battle controller RNG boundary", () => {
  it("uses external randomness only to create the runtime seed", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.25);
    const { result } = renderHook(() => useExpeditionBattleController());

    expect(random).toHaveBeenCalledTimes(1);

    act(() => {
      const transition = result.current.dispatch({ type: "roll-dice" });
      expect(transition.error).toBeNull();
    });

    expect(random).toHaveBeenCalledTimes(1);
    expect(result.current.state.rng.combat.cursor).toBeGreaterThan(0);
  });
});
