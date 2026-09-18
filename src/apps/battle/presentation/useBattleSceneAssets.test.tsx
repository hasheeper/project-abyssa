import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("../../../shared/loading/images", () => ({prepareImages: vi.fn()}));
import { prepareImages } from "../../../shared/loading/images";
import { SceneTransitionContext } from "../../../shared/transition/TransitionProvider";
import { useBattleSceneAssets } from "./useBattleSceneAssets";

const hold = vi.fn(), release = vi.fn();
function Scope({children}: {children: ReactNode}) {
  return <SceneTransitionContext.Provider value={{phase:"closed",isTransitioning:true,navigate:()=>true,holdReady:hold}}>{children}</SceneTransitionContext.Provider>;
}
beforeEach(() => { vi.clearAllMocks(); hold.mockReturnValue(release); });
afterEach(cleanup);
function deferred() { let resolve!: () => void, reject!: (error: Error) => void; const promise = new Promise<void>((yes,no) => {resolve=yes;reject=no;}); return {promise,resolve,reject}; }

it("holds readiness until decode finishes, without blanking on HP updates or a cleared room", async () => {
  const load = deferred(); vi.mocked(prepareImages).mockReturnValue(load.promise);
  const result = renderHook(({urls}) => useBattleSceneAssets(urls), {wrapper:Scope,initialProps:{urls:["hall.jpg","guest.png"]}});
  expect(result.result.current.status).toBe("loading"); expect(hold).toHaveBeenCalledTimes(1);
  await act(async () => load.resolve());
  expect(result.result.current.status).toBe("ready"); expect(release).toHaveBeenCalledTimes(1);
  result.rerender({urls:["hall.jpg","guest.png"]});
  result.rerender({urls:["hall.jpg"]});
  expect(result.result.current.status).toBe("ready"); expect(prepareImages).toHaveBeenCalledTimes(1);
});
it("releases the curtain on failure and retries art without any game command", async () => {
  const fail = deferred(), retry = deferred();
  vi.mocked(prepareImages).mockReturnValueOnce(fail.promise).mockReturnValueOnce(retry.promise);
  const result = renderHook(() => useBattleSceneAssets(["hall.jpg"]), {wrapper:Scope});
  await act(async () => fail.reject(new Error("decode")));
  expect(result.result.current.status).toBe("error"); expect(release).toHaveBeenCalledTimes(1);
  act(() => result.result.current.retry());
  expect(result.result.current.status).toBe("loading"); expect(hold).toHaveBeenCalledTimes(2);
  await act(async () => retry.resolve());
  expect(result.result.current.status).toBe("ready");
});
it("cannot let a late old-room load release a newer room, and releases on unmount", async () => {
  const old = deferred(), next = deferred();
  vi.mocked(prepareImages).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const result = renderHook(({urls}) => useBattleSceneAssets(urls), {wrapper:Scope,initialProps:{urls:["hall.jpg"]}});
  result.rerender({urls:["corridor.jpg"]});
  await act(async () => old.resolve());
  expect(result.result.current.status).toBe("loading"); expect(release).not.toHaveBeenCalled();
  result.unmount(); expect(release).toHaveBeenCalledTimes(1);
  await act(async () => next.resolve());
});
