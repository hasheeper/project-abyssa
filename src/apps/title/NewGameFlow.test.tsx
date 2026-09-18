import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { newGameFixture } from "../../game-client/testing/new-game";
import { GameStorageError } from "../../game-application";
import { TitlePage } from "./TitlePage";

type Fixture = ReturnType<typeof newGameFixture>;
let runtime: Fixture["runtime"], db: Fixture["db"], store: Fixture["store"];
const navigate = vi.fn();
vi.mock("../../game-runtime/browser", () => ({createBrowserGameRuntime: () => runtime}));
vi.mock("../../shared/transition", () => ({SceneTransitionProvider: ({children}: {children: ReactNode}) => children,
  useSceneTransition: () => ({navigate, isTransitioning: false})}));
beforeEach(() => {
  ({db, store, runtime} = newGameFixture());
  navigate.mockReset(); localStorage.clear(); sessionStorage.clear();
});
afterEach(cleanup);
async function mount() { await act(async () => { render(<TitlePage/>); }); }

it("opens before playback and cancels without creating a save or request identity", async () => {
  const user = userEvent.setup(); await mount();
  expect(screen.getByRole("button", {name: "新的开始"})).toHaveAttribute("data-highlighted");
  await user.click(screen.getByRole("button", {name: "新的开始"}));
  expect(screen.getByRole("dialog", {name: "选择旅程起点"})).toBeVisible();
  expect(db.records.size).toBe(0);
  expect(sessionStorage.length).toBe(0);
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "跳过教程"}), {detail: 2});
  expect(db.records.size).toBe(0);
  expect(navigate).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name: "关闭选择旅程起点"}));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(db.records.size).toBe(0);
});

it.each([
  ["完整开始", "prologue"], ["跳过序章", "mansion"],
  ["跳过第一章（抵达教程）", "battle"], ["跳过教程", "menu"],
])("%s hands off to %s once, and Continue reuses the saved start", async (label, page) => {
  const user = userEvent.setup(); await mount();
  const create = vi.spyOn(runtime.application, "createNewGame");
  await user.click(screen.getByRole("button", {name: "新的开始"}));
  await user.dblClick(screen.getByRole("button", {name: label}));
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledTimes(1);
  expect(navigate.mock.calls[0][0]).toContain(`#/${page}?`);
  expect(db.records.size).toBe(1);
  expect(sessionStorage.length).toBe(0);
  cleanup(); navigate.mockClear(); await mount();
  expect(screen.getByRole("button", {name: "继续游戏"})).toHaveAttribute("data-highlighted");
  await user.click(screen.getByRole("button", {name: "继续游戏"}));
  expect(screen.queryByRole("dialog", {name: "选择旅程起点"})).toBeNull();
  expect(navigate.mock.calls[0][0]).toContain(`#/${page}?`);
  expect(db.records.size).toBe(1);
});

it("preserves the pending identity across a remount and retries the selected start", async () => {
  const commit = store.commit.bind(store);
  store.commit = async proposal => {
    if (proposal.candidate?.head.revision === 1) throw new GameStorageError("storage-quota", "full");
    return commit(proposal);
  };
  const user = userEvent.setup(); await mount();
  await user.click(screen.getByRole("button", {name: "新的开始"}));
  await user.click(screen.getByRole("button", {name: "跳过教程"}));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("存储空间不足"));
  expect(navigate).not.toHaveBeenCalled();
  const savedIdentity = sessionStorage.getItem("abyssa:new-save:guided-start-v1:hub");
  expect(savedIdentity).not.toBeNull();
  cleanup(); store.commit = commit; await mount();
  await user.click(screen.getByRole("button", {name: "新的开始"}));
  await user.click(screen.getByRole("button", {name: "跳过教程"}));
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(navigate.mock.calls[0][0]).toContain("#/menu?");
  expect(db.records.size).toBe(1);
  expect([...db.records.values()][0].head.revision).toBe(1);
  expect(sessionStorage.getItem("abyssa:new-save:guided-start-v1:hub")).toBeNull();
});
