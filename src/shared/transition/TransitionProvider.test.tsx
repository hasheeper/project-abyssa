import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SceneTransitionProvider, useSceneReady } from "./TransitionProvider";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers(); });

it("keeps the existing curtain closed until the actual scene data is ready, including beyond the image timeout", async () => {
  vi.useFakeTimers();
  sessionStorage.setItem("abyssa:scene-handoff:v1", JSON.stringify({target:location.pathname + location.search,issuedAt:Date.now(),destination:"测试场景"}));
  function Scene({ready}:{ready:boolean}) { useSceneReady(ready); return <div>{ready ? "真实场景" : "等待读档"}</div>; }
  const view = (ready:boolean) => <SceneTransitionProvider minimumBlackoutMs={0} maximumReadyWaitMs={80}><Scene ready={ready}/></SceneTransitionProvider>;
  const {container,rerender} = render(view(false));
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase","closed");
  rerender(view(true));
  await act(() => vi.advanceTimersByTimeAsync(250));
  expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase","opening");
  await act(() => vi.advanceTimersByTimeAsync(650));
  expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase","idle");
});
