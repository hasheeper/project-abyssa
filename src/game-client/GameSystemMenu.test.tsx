import { IDBFactory } from "fake-indexeddb";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameSystemMenu } from "./GameSystemMenu";
import { indexedClientFixture } from "./testing/indexed-client";
import { browserArchiveStore, browserSaveSlots } from "../game-runtime/save-slots";
import { UiMotionProvider } from "../shared/ui/motion/UiMotionProvider";
import { navigateTo } from "../shared/routing/location";

let fixture: Awaited<ReturnType<typeof indexedClientFixture>>;
vi.mock("./title-save-list", () => ({readTitleSaveList: () => fixture.runtime.application.list()}));
vi.mock("../game-runtime/browser", () => ({createBrowserGameRuntime: () => fixture.runtime}));
vi.mock("../shared/routing/location", async original => ({...await original<typeof import("../shared/routing/location")>(), navigateTo: vi.fn()}));
beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockReturnValue(document.body);
  localStorage.clear(); sessionStorage.clear();
  fixture = await indexedClientFixture({start: false});
});
afterEach(() => { cleanup(); fixture.session.dispose(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function mount({withRecord = true, busy = false} = {}) {
  const backgroundAction = vi.fn();
  const view = render(<UiMotionProvider preference="reduced"><div className="abyssa-stage__canvas">
    <div data-testid="original-scene">
      <button onClick={backgroundAction}>场景操作</button>
      <GameSystemMenu record={withRecord ? fixture.session.getSnapshot().record : null} runtime={fixture.runtime} busy={busy}
        navigation={[{id: "menu", label: "返回菜单", href: "#/menu"}]} />
    </div>
  </div></UiMotionProvider>);
  return {...view, backgroundAction, user: userEvent.setup()};
}
async function openSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", {name: "存档"}));
  await screen.findByRole("button", {name: "槽位 02 · 空白存档"});
  await waitFor(() => expect(document.querySelector(".system-scene__interaction")).not.toHaveAttribute("inert"));
  await user.click(screen.getByRole("button", {name: "槽位 02 · 空白存档"}));
}

it("opens the existing slots over the Stage, saves a copy and loads that exact slot", async () => {
  const {user} = mount();
  const before = await fixture.runtime.application.open("save");
  const saveButton = screen.getByRole("button", {name: "存档"});
  await openSave(user);
  expect(screen.getByTestId("original-scene").querySelector('[role="dialog"]')).toBeNull();
  expect(document.querySelector(".abyssa-stage__canvas > .game-system-layer")).toBeInTheDocument();
  await user.click(screen.getByRole("button", {name: "确认存档"}));
  await screen.findByText("已保存至槽位 02");
  const saved = (await browserSaveSlots.read())!.slots[1]!;
  expect(saved.saveId).not.toBe("save");
  expect(await fixture.runtime.application.open("save")).toEqual(before);
  await user.click(screen.getByRole("button", {name: "返回游戏"}));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(saveButton).toHaveFocus());
  await user.click(screen.getByRole("button", {name: "读档"}));
  const slot = await screen.findByRole("button", {name: "槽位 02 · 守望者之崖"});
  await waitFor(() => expect(document.querySelector(".system-scene__interaction")).not.toHaveAttribute("inert"));
  await user.click(slot);
  await user.click(screen.getByRole("button", {name: "读取所选档案"}));
  await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(expect.stringContaining(saved.saveId), expect.objectContaining({channel: "正在读取"})));
});

it("keeps the game and exit locked until the save transaction has finished", async () => {
  const {user, backgroundAction} = mount();
  await openSave(user);
  const change = browserArchiveStore.change.bind(browserArchiveStore);
  let release!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;});
  vi.spyOn(browserArchiveStore, "change").mockImplementation(async input => {await pending; return change(input);});
  await user.click(screen.getByRole("button", {name: "确认存档"}));
  await waitFor(() => expect(browserArchiveStore.change).toHaveBeenCalled());
  expect(screen.getByRole("button", {name: "返回游戏"})).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog", {name: "保存档案"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "场景操作"}));
  expect(backgroundAction).not.toHaveBeenCalled();
  await act(async () => release());
  await screen.findByText("已保存至槽位 02");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("retains LOAD and SETTINGS without a campaign and returns settings focus to its entry", async () => {
  const {user} = mount({withRecord: false});
  expect(screen.getByRole("button", {name: "存档"})).toBeDisabled();
  expect(screen.getByRole("button", {name: "读档"})).toBeEnabled();
  const settings = screen.getByRole("button", {name: "设置"});
  await user.click(settings);
  await screen.findByRole("dialog", {name: "系统设置"});
  await waitFor(() => expect(document.querySelector(".system-scene__interaction")).not.toHaveAttribute("inert"));
  await user.click(screen.getByRole("tab", {name: "Display"}));
  await screen.findByRole("heading", {name: "视觉显示"});
  await user.click(screen.getByRole("button", {name: "返回"}));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(settings).toHaveFocus());
  expect(navigateTo).not.toHaveBeenCalled();
});

it("disables all system entries while a scene action is running", async () => {
  const {user} = mount({busy: true});
  for (const name of ["存档", "读档", "设置"]) {
    const button = screen.getByRole("button", {name});
    expect(button).toBeDisabled();
    await user.click(button);
  }
  expect(screen.queryByRole("dialog")).toBeNull();
});
