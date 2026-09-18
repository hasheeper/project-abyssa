import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SceneTransition } from "./SceneTransition";
import type { SceneTransitionPhase } from "./types";

afterEach(cleanup);
it.each<SceneTransitionPhase>(["idle", "closing", "closed", "opening"])("exposes the exact idle pause boundary during %s", phase => {
  const {container} = render(<SceneTransition phase={phase}/>);
  const curtain = container.querySelector(".scene-transition")!;
  expect(curtain.hasAttribute("data-active")).toBe(phase !== "idle");
  expect(curtain.matches(".scene-transition:not([data-active])")).toBe(phase === "idle");
  expect(curtain.querySelectorAll(".scene-transition__activity i")).toHaveLength(3);
  expect(curtain.querySelectorAll(".scene-transition__spinner > [data-plane]")).toHaveLength(6);
});
it("keeps progress, errors and cinematic handoffs free of unrelated status ticks", () => {
  const view = render(<SceneTransition phase="closed" progress={20}/>);
  expect(view.container.querySelector(".scene-transition__activity")).toBeNull();
  view.rerender(<SceneTransition phase="closed" error="加载失败"/>);
  expect(view.container.querySelector(".scene-transition__activity")).toBeNull();
  view.rerender(<SceneTransition phase="closed" cinematic/>);
  expect(view.container.querySelector(".scene-transition__activity")).toBeNull();
});
