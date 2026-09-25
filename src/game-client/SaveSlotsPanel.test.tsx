import { IDBFactory } from "fake-indexeddb";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveSlotsPanel } from "./SaveSlotsPanel";
import { createManualSaveAttempt } from "./manual-save";
import { indexedClientFixture as clientFixture } from "./testing/indexed-client";
import { browserArchiveStore, browserSaveSlots, writeSaveSlot } from "../game-runtime/save-slots";
import { UiMotionProvider } from "../shared/ui/motion/UiMotionProvider";

let fixture: Awaited<ReturnType<typeof clientFixture>>;
vi.mock("./title-save-list", () => ({ readTitleSaveList: () => fixture.runtime.application.list() }));
vi.mock("../game-runtime/browser", () => ({ createBrowserGameRuntime: () => fixture.runtime }));
beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockReturnValue(document.body);
  localStorage.clear(); sessionStorage.clear(); fixture = await clientFixture({ start: false });
});
afterEach(() => { cleanup(); fixture.session.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function mount(mode: "save" | "load" = "save") {
  const opened = await fixture.runtime.application.open("save");
  if (!opened.ok) throw new Error("fixture failed");
  const props = { onClose: vi.fn(), onBusyChange: vi.fn(), navigate: vi.fn() };
  const attempt = createManualSaveAttempt(fixture.runtime, opened.record);
  const view = render(mode === "save" ? <SaveSlotsPanel {...props} mode="save" ready attempt={attempt} /> : <SaveSlotsPanel {...props} mode="load" />,
    {wrapper: ({children}) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider>});
  await screen.findByRole("button", { name: "槽位 01 · 守望者之崖" });
  return { ...props, ...view, attempt, user: userEvent.setup() };
}
async function saveSecondSlot(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", {name: "槽位 02 · 空白存档"}));
  await user.click(screen.getByRole("button", {name: "确认存档"}));
  await screen.findByText("已保存至槽位 02");
  return (await browserSaveSlots.read())!.slots[1]!;
}
describe("RPG save / load slots", () => {
  it("renders two rows of five per page, with thirty stable positions and no opening writes", async () => {
    const { user, container } = await mount();
    expect(container.querySelectorAll(".save-slots__rail")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^槽位 / })).toHaveLength(10);
    expect(await browserSaveSlots.read()).toBeNull();
    await user.click(screen.getByRole("button", { name: "第 3 页，槽位 21 至 30" }));
    expect(screen.getByRole("button", { name: "槽位 30 · 空白存档" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "槽位 31 · 空白存档" })).toBeNull();
    expect(await fixture.store.listSaveIds()).toEqual(["save"]);
  });
  it("requires confirmation for an occupied position and Escape cancels without a write", async () => {
    const { user, onClose } = await mount();
    const old = await saveSecondSlot(user);
    await user.click(screen.getByRole("button", { name: "确认存档" }));
    await screen.findByRole("dialog", {name: "覆盖槽位 02？"});
    await waitFor(() => expect(screen.getByRole("button", { name: "取消" })).toHaveFocus());
    expect(await fixture.store.listSaveIds()).toEqual(["save", old.saveId]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect((await browserSaveSlots.read())!.slots[1]).toEqual(old);
  });
  it("saves into an empty slot, displays a real timestamp, and restores the binding in LOAD", async () => {
    const { user, unmount } = await mount();
    await user.click(screen.getByRole("button", { name: "槽位 02 · 空白存档" }));
    await user.click(screen.getByRole("button", { name: "确认存档" }));
    await screen.findByText("已保存至槽位 02");
    const index = await browserSaveSlots.read();
    expect(index?.slots[1]?.saveId).not.toBe("save");
    expect(Number.isFinite(Date.parse(index!.slots[1]!.savedAt!))).toBe(true);
    expect(screen.getByRole("button", { name: "槽位 02 · 守望者之崖" }).querySelector("time")).toHaveAttribute("datetime", index!.slots[1]!.savedAt);
    unmount(); const load = await mount("load");
    await load.user.click(screen.getByRole("button", { name: "槽位 03 · 空白存档" }));
    expect(screen.getByRole("button", { name: "读取所选档案" })).toBeDisabled();
    await load.user.click(screen.getByRole("button", { name: "槽位 02 · 守望者之崖" }));
    expect(screen.getByRole("button", { name: "读取所选档案" })).toBeEnabled();
    await load.user.click(screen.getByRole("button", { name: "读取所选档案" }));
    await waitFor(() => expect(load.navigate).toHaveBeenCalledWith(expect.stringContaining(index!.slots[1]!.saveId)));
  });
  it("permanently replaces a slot after confirmation while preserving the running campaign", async () => {
    const { user } = await mount();
    const before = await fixture.runtime.application.open("save");
    const old = await saveSecondSlot(user);
    await user.click(screen.getByRole("button", { name: "确认存档" }));
    await user.click(await screen.findByRole("button", { name: "确认覆盖" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findByText("已保存至槽位 02");
    expect(await fixture.runtime.application.open("save")).toEqual(before);
    expect(await fixture.store.read(old.saveId)).toBeNull();
    expect((await browserSaveSlots.read())!.slots[1]?.saveId).not.toBe(old.saveId);
    expect(await fixture.store.listSaveIds()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "其他档案" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^选择档案 / })).toBeNull();
  });
  it("retries a transaction failure without creating an orphan copy", async () => {
    const { user } = await mount();
    vi.spyOn(browserArchiveStore, "change").mockRejectedValueOnce(new Error("目录写入失败"));
    await user.click(screen.getByRole("button", { name: "槽位 02 · 空白存档" }));
    await user.click(screen.getByRole("button", { name: "确认存档" }));
    await screen.findByText("目录写入失败");
    expect(await fixture.store.listSaveIds()).toHaveLength(1);
    expect(await browserSaveSlots.read()).toBeNull();
    await user.click(screen.getByRole("button", { name: "重试存档" }));
    await screen.findByText("已保存至槽位 02");
    expect(await fixture.store.listSaveIds()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "槽位 03 · 空白存档" }));
    await user.click(screen.getByRole("button", { name: "确认存档" }));
    await screen.findByText("已保存至槽位 03");
    const saved = await browserSaveSlots.read();
    expect(saved!.slots[1]!.saveId).not.toBe(saved!.slots[2]!.saveId);
    expect(await fixture.store.listSaveIds()).toHaveLength(3);
  });
  it("rejects a changed slot instead of overwriting another tab's binding", async () => {
    const { user } = await mount();
    const old = await saveSecondSlot(user);
    await user.click(screen.getByRole("button", { name: "确认存档" }));
    await screen.findByRole("dialog", {name: "覆盖槽位 02？"});
    const winner = { saveId: "another-tab", epoch: "epoch", savedAt: null };
    await act(async () => { await writeSaveSlot(browserSaveSlots, (await browserSaveSlots.read())!, 1, winner); });
    await user.click(screen.getByRole("button", { name: "确认覆盖" }));
    await screen.findByText("槽位已在另一页面更新，请刷新后重新选择。");
    expect((await browserSaveSlots.read())!.slots[1]).toEqual(winner);
    expect(await fixture.store.read(old.saveId)).not.toBeNull();
    expect(await fixture.store.listSaveIds()).toHaveLength(2);
  });
  it("moves focus between rows and pages using arrow and PageDown keys", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "槽位 01 · 守望者之崖" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "槽位 06 · 空白存档" })).toHaveFocus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("button", { name: "槽位 16 · 空白存档" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "槽位 20 · 空白存档" })).toHaveFocus();
    expect(await fixture.store.listSaveIds()).toEqual(["save"]);
  });
  it("uses icon-only import/export buttons with accessible names and hover labels", async () => {
    const { user } = await mount();
    const importButton = screen.getByRole("button", { name: "导入档案" });
    expect(importButton.textContent).toBe("");
    expect(importButton).toHaveAttribute("title", "导入档案");
    expect(importButton.querySelector(".save-file-icon")).not.toBeNull();
    const exportButton = screen.getByRole("button", { name: "导出槽位 01" });
    expect(exportButton.textContent).toBe("");
    expect(exportButton).toHaveAttribute("title", "导出槽位 01");
    await user.click(importButton);
    expect(screen.getByRole("region", { name: "导入档案" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
