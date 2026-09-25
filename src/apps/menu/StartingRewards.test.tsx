import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { shopFixture } from "../../game-application/testing/shop-foundation-fixture";
import { StartingRewards } from "./StartingRewards";

// Node's experimental localStorage shadows jsdom's local store in this runner.
beforeEach(() => {vi.stubGlobal("localStorage", window.sessionStorage); window.localStorage.clear();});
afterEach(() => {cleanup(); window.localStorage.clear(); vi.unstubAllGlobals();});
it("waits for the scene, lists committed quantities and suppresses refresh duplicates", async () => {
  const f = shopFixture();
  await f.runtime.application.createNewGame({saveId: f.saveId, epoch: "reward-epoch", clientRequestId: "create", startAt: "hub"});
  const record = f.read(), reward = f.runtime.queries.startReward(record)!;
  const props = {reward, saveId: record.head.saveId, epoch: record.head.epoch};
  const view = render(<StartingRewards {...props} paused/>);
  expect(screen.queryByText("教程奖励已获得")).toBeNull();
  expect(window.localStorage.length).toBe(0);
  view.rerender(<StartingRewards {...props} paused={false}/>);
  expect(screen.getByText("教程奖励已获得")).toBeInTheDocument();
  expect(view.container.querySelectorAll(".scene-feedback__rewards > li")).toHaveLength(7);
  expect(screen.getByText("×3")).toBeInTheDocument();
  expect(screen.getByText("×2")).toBeInTheDocument();
  expect(screen.getAllByText("×1")).toHaveLength(3);
  expect(screen.getByText("×12")).toBeInTheDocument();
  expect(screen.getByLabelText("铜里拉 4,400 G")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(<StartingRewards {...props} paused/>);
  expect(screen.getByText("教程奖励已获得")).not.toBeVisible();
  view.rerender(<StartingRewards {...props} paused={false}/>);
  await waitFor(() => expect(screen.getByText("教程奖励已获得")).toBeVisible());
  view.unmount();
  render(<StartingRewards {...props} paused={false}/>);
  expect(screen.queryByText("教程奖励已获得")).toBeNull();
  expect(f.read()).toEqual(record);
});
