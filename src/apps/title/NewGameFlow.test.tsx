import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { newGameFixture } from "../../game-client/testing/new-game";
import { GameStorageError } from "../../game-application";
import { TitlePage } from "./TitlePage";
import { NEW_GAME_PENDING_KEY } from "./useTitleArchive";

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
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", {name: "新的开始"}));
  await waitFor(() => expect(screen.getByRole("textbox", {name: "请输入角色姓名"})).toBeEnabled(), {timeout: 1600});
}
async function select(user: ReturnType<typeof userEvent.setup>, label: string) {
  await open(user);
  await user.type(screen.getByRole("textbox"), "林恩");
  await user.click(screen.getByRole("button", {name: /下一步/}));
  if (label.includes("调试")) {
    expect(screen.queryByRole("radio", {name: /AIRP 快速体验/})).toBeNull();
    await user.click(screen.getByText("调试入口"));
    await user.click(screen.getByRole("button", {name: label}));
  }
  else {
    await user.click(screen.getByRole("radio", {name: new RegExp(label)}));
    await user.click(screen.getByRole("button", {name: /下一步/}));
  }
  expect(db.records.size).toBe(0);
  expect(sessionStorage.length).toBe(0);
}

it("opens before playback and cancels without creating a save or request identity", async () => {
  const user = userEvent.setup(); await mount();
  expect(screen.getByRole("button", {name: "新的开始"})).toHaveAttribute("data-highlighted");
  await open(user);
  expect(screen.getByRole("dialog", {name: "新的开始"})).toBeVisible();
  expect(db.records.size).toBe(0);
  expect(sessionStorage.length).toBe(0);
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: /下一步/}), {detail: 2});
  expect(db.records.size).toBe(0);
  expect(navigate).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name: "返回标题"}));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(db.records.size).toBe(0);
});

it.each([
  ["序章", "prologue"], ["洋馆的清晨", "mansion"],
  ["战斗与探索教学", "battle"], ["自由行动", "menu"],
  ["商店初见调试", "menu"],
  ["旧版 AIRP 调试", "mansion"],
  ["AIRP 游玩", "mansion"],
])("%s hands off to %s once, and Continue reuses the saved start", async (label, page) => {
  const user = userEvent.setup(); await mount();
  const create = vi.spyOn(runtime.application, "createNewGame");
  await select(user, label);
  await user.dblClick(screen.getByRole("button", {name: /开始游戏/}));
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({playerName: "林恩"}));
  expect(navigate.mock.calls[0][1]).toMatchObject({cinematic: true});
  expect(navigate.mock.calls[0][0]).toContain(`#/${page}?`);
  expect(db.records.size).toBe(1);
  expect(sessionStorage.length).toBe(0);
  cleanup(); navigate.mockClear(); await mount();
  expect(screen.getByRole("button", {name: "继续游戏"})).toHaveAttribute("data-highlighted");
  await user.click(screen.getByRole("button", {name: "继续游戏"}));
  expect(screen.queryByRole("dialog", {name: "新的开始"})).toBeNull();
  expect(navigate.mock.calls[0][0]).toContain(`#/${page}?`);
  expect(db.records.size).toBe(1);
});

it.each([["自由行动", "hub"], ["商店初见调试", "debug-shop"]])("preserves the pending %s identity across a remount and retries the selected start", async (label, startAt) => {
  const commit = store.commit.bind(store);
  store.commit = async proposal => {
    if (proposal.candidate?.head.revision === 1) throw new GameStorageError("storage-quota", "full");
    return commit(proposal);
  };
  const user = userEvent.setup(); await mount();
  await select(user, label);
  await user.click(screen.getByRole("button", {name: /开始游戏/}));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("存储空间不足"));
  expect(navigate).not.toHaveBeenCalled();
  const savedIdentity = sessionStorage.getItem(NEW_GAME_PENDING_KEY);
  expect(savedIdentity).not.toBeNull();
  expect(JSON.parse(savedIdentity!)).toMatchObject({playerName: "林恩", startAt});
  cleanup(); store.commit = commit; await mount();
  await user.click(screen.getByRole("button", {name: "新的开始"}));
  await waitFor(() => expect(screen.getByRole("button", {name: /重试创建/})).toBeEnabled(), {timeout: 1600});
  expect(screen.getByRole("dialog")).toHaveTextContent("林恩");
  expect(screen.queryByRole("button", {name: "上一步"})).toBeNull();
  await user.click(screen.getByRole("button", {name: /重试创建/}));
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(navigate.mock.calls[0][0]).toContain("#/menu?");
  expect(db.records.size).toBe(1);
  expect([...db.records.values()][0].head.revision).toBe(1);
  const record = [...db.records.values()][0];
  expect(runtime.queries.shop(record)?.introduction?.step ?? null).toBe(startAt === "debug-shop" ? 0 : null);
  expect(sessionStorage.getItem(NEW_GAME_PENDING_KEY)).toBeNull();
});

it("keeps a debug selection when stepping back and allows returning to the normal starts", async () => {
  const user = userEvent.setup(); await mount();
  await select(user, "旧版 AIRP 调试");
  await user.click(screen.getByRole("button", {name: "上一步"}));
  expect(screen.getByRole("button", {name: "旧版 AIRP 调试"})).toBeVisible();
  expect(screen.getByRole("radio", {name: "序章"})).toHaveAttribute("tabindex", "0");
  await user.click(screen.getByRole("button", {name: "下一步"}));
  expect(screen.getByRole("dialog")).toHaveTextContent("旧版 AIRP 调试");
  await user.click(screen.getByRole("button", {name: "上一步"}));
  await user.click(screen.getByRole("radio", {name: "序章"}));
  await user.keyboard("{End}");
  expect(screen.getByRole("radio", {name: "AIRP 游玩"})).toHaveAttribute("aria-checked", "true");
  await user.click(screen.getByRole("button", {name: "下一步"}));
  expect(screen.getByRole("dialog")).toHaveTextContent("AIRP 游玩");
  expect(screen.getByRole("dialog")).not.toHaveTextContent("旧版 AIRP 调试");
  expect(db.records.size).toBe(0);
});

it("validates a name and preserves the draft when stepping back; IME and held Enter do not advance", async () => {
  const user = userEvent.setup(); await mount(); await open(user);
  await user.click(screen.getByRole("button", {name: /下一步/}));
  expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  const input = screen.getByRole("textbox");
  await user.type(input, "  林恩  ");
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, {key: "Enter", keyCode: 229, isComposing: true});
  fireEvent.submit(input.closest("form")!);
  expect(screen.getByRole("heading", {name: "角色姓名"})).toBeVisible();
  fireEvent.compositionEnd(input);
  const held = new KeyboardEvent("keydown", {key: "Enter", repeat: true, bubbles: true, cancelable: true});
  expect(input.dispatchEvent(held)).toBe(false);
  await user.click(screen.getByRole("button", {name: /下一步/}));
  expect(screen.getAllByRole("radio")).toHaveLength(5);
  await user.click(screen.getByRole("radio", {name: "自由行动"}));
  await user.click(screen.getByRole("button", {name: "上一步"}));
  expect(screen.getByRole("textbox")).toHaveValue("林恩");
  await user.click(screen.getByRole("button", {name: /下一步/}));
  expect(screen.getByRole("radio", {name: "自由行动"})).toHaveAttribute("aria-checked", "true");
  expect(db.records.size).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
