import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useExpeditionBattleController } from "./useExpeditionBattleController";
import { clientFixture } from "../../../game-client/testing/helpers";
import { GameSessionScope } from "../../../game-client/react";
afterEach(() => vi.restoreAllMocks());
describe("Battle controller persistence boundary", () => {
  it("keeps durable progress ahead of the visual copy", async () => {
    const fixture = await clientFixture();
    const { result, unmount } = renderHook(() => useExpeditionBattleController(), { wrapper: ({ children }: { children: ReactNode }) => createElement(GameSessionScope, { session: fixture.session, children }) });
    await act(async () => { const batch = await result.current.submit({ type: "roll-dice" }); expect(batch?.presentable).toBe(true); });
    expect((fixture.session.getSnapshot().record as import("../../../game-application").GameRecord).snapshot.encounter!.turn!.type).toBe("player-turn");
    expect(result.current.state.mode.type).toBe("awaiting-roll");
    act(() => result.current.finish());
    expect(result.current.state.mode.type).toBe("player-turn");
    unmount(); fixture.session.dispose();
  });
});
