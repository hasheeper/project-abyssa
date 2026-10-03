import { IDBFactory } from "fake-indexeddb";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveSlotsPanel } from "./SaveSlotsPanel";
import { createManualSaveAttempt } from "./manual-save";
import { indexedClientFixture as clientFixture } from "./testing/indexed-client";
import { browserArchiveStore, browserSaveSlots, writeSaveSlot } from "../game-runtime/save-slots";
import { UiMotionProvider } from "../shared/ui/motion/UiMotionProvider";
import { createPlayerRuntime } from "../game-runtime/player-runtime";
import { IndexedDbGameStore } from "../game-infrastructure/storage/indexeddb";
import type { AnyGameRecord, AnyReceipt } from "../game-application";

let fixture: Awaited<ReturnType<typeof clientFixture>>;
let formalRuntime: ReturnType<typeof createPlayerRuntime> | null = null;
vi.mock("./title-save-list", () => ({ readTitleSaveList: () => (formalRuntime ?? fixture.runtime).application.list() }));
vi.mock("../game-runtime/browser", () => ({ createBrowserGameRuntime: () => formalRuntime ?? fixture.runtime }));
beforeEach(async () => {
  formalRuntime = null;
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
  it("opens with a writable slot selected instead of the protected running save", async () => {
    const {user, attempt, rerender, onClose, onBusyChange, navigate} = await mount();
    await waitFor(() => {
      expect(screen.getByRole("button", {name: "槽位 02 · 空白存档"})).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", {name: "确认存档"})).toBeEnabled();
    });
    rerender(<SaveSlotsPanel mode="load" onClose={onClose} onBusyChange={onBusyChange} navigate={navigate}/>);
    await user.click(screen.getByRole("button", {name: "槽位 01 · 守望者之崖"}));
    rerender(<SaveSlotsPanel mode="save" ready attempt={attempt} onClose={onClose} onBusyChange={onBusyChange} navigate={navigate}/>);
    await waitFor(() => {
      expect(screen.getByRole("button", {name: "槽位 02 · 空白存档"})).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", {name: "确认存档"})).toBeEnabled();
    });
  });
  it("waits for the archive list before automatically selecting a writable slot", async () => {
    const opened = await fixture.runtime.application.open("save");
    if (!opened.ok) throw new Error("fixture failed");
    const listed = await fixture.runtime.application.list();
    let releaseList!: () => void;
    const list = vi.spyOn(fixture.runtime.application, "list").mockImplementationOnce(() => new Promise(resolve => {
      releaseList = () => resolve(listed);
    }));
    const readSlots = vi.spyOn(browserSaveSlots, "read");
    render(<UiMotionProvider preference="reduced"><SaveSlotsPanel mode="save" ready
      attempt={createManualSaveAttempt(fixture.runtime, opened.record)} onClose={vi.fn()} onBusyChange={vi.fn()} navigate={vi.fn()}/></UiMotionProvider>);
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1);
      expect(readSlots).toHaveBeenCalledTimes(1);
    });
    await act(async () => { await readSlots.mock.results[0].value; });
    expect(screen.getByRole("button", {name: "确认存档"})).toBeDisabled();
    await act(async () => { releaseList(); });
    await waitFor(() => {
      expect(screen.getByRole("button", {name: "槽位 02 · 空白存档"})).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", {name: "确认存档"})).toBeEnabled();
    });
    expect(await browserSaveSlots.read()).toBeNull();
  });
  it("saves formal AIRP snapshots into slots 31 and 32 and reads both back without modifying the live save", async () => {
    const store = new IndexedDbGameStore<AnyGameRecord, AnyReceipt>();
    let serial = 0;
    formalRuntime = createPlayerRuntime(store, {newId: () => `formal-slot-${++serial}`, newSeed: () => 19, close: () => store.close()});
    const created = await formalRuntime.application.createNewGame({saveId: "formal-source", epoch: "formal-epoch", clientRequestId: "create-formal", startAt: "hub"});
    if (!created.ok) throw new Error(created.error.message);
    await formalRuntime.airpGame.forSave("formal-source", 28).sync();
    const opened = await formalRuntime.application.open("formal-source");
    if (!opened.ok || opened.record.schemaVersion !== 4) throw new Error("Missing formal save");
    const source = opened.record;
    render(<UiMotionProvider preference="reduced"><SaveSlotsPanel mode="save" ready
      attempt={createManualSaveAttempt(formalRuntime, source)} onClose={vi.fn()} onBusyChange={vi.fn()} navigate={vi.fn()}/></UiMotionProvider>);
    await waitFor(() => expect(screen.getByRole("button", {name: "确认存档"})).toBeEnabled());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "第 4 页，槽位 25 至 32"}));
    for (const position of [31, 32]) {
      await user.click(screen.getByRole("button", {name: `槽位 ${position} · 空白存档`}));
      await user.click(screen.getByRole("button", {name: "确认存档"}));
      await screen.findByText(`已保存至槽位 ${position}`, {}, {timeout: 10000});
      const binding = (await browserSaveSlots.read())!.slots[position - 1]!;
      const restored = await formalRuntime.application.open(binding.saveId);
      if (!restored.ok || restored.record.schemaVersion !== 4) throw new Error("Missing saved snapshot");
      expect(restored.record.snapshot).toEqual(source.snapshot);
      expect(restored.record.airpDirector).toEqual(source.airpDirector);
      expect(restored.record.airpGame?.worldHead).toEqual(restored.record.head);
    }
    const slots = (await browserSaveSlots.read())!;
    expect(slots.slots).toHaveLength(32);
    expect(slots.slots[30]!.saveId).not.toBe(slots.slots[31]!.saveId);
    expect(await formalRuntime.application.open("formal-source")).toEqual({ok: true, record: source});
    store.close();
  }, 30000);
  it.each(["save", "load"] as const)("renders two rows of four in %s, with thirty-two stable positions and no opening writes", async mode => {
    const { user, container } = await mount(mode);
    expect(container.querySelectorAll(".save-slots__rail")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^槽位 / })).toHaveLength(8);
    for (const rail of container.querySelectorAll(".save-slots__rail")) expect(rail.querySelectorAll(".save-slots__slot")).toHaveLength(4);
    expect(await browserSaveSlots.read()).toBeNull();
    await user.click(screen.getByRole("button", { name: "第 2 页，槽位 9 至 16" }));
    expect(screen.getByRole("button", { name: "槽位 09 · 空白存档" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^槽位 / })).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "第 3 页，槽位 17 至 24" }));
    expect(screen.getByRole("button", { name: "槽位 24 · 空白存档" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "第 4 页，槽位 25 至 32" }));
    expect(screen.getAllByRole("button", { name: /^槽位 / })).toHaveLength(8);
    expect(screen.getByRole("button", { name: "槽位 32 · 空白存档" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "槽位 33 · 空白存档" })).toBeNull();
    expect(await browserSaveSlots.read()).toBeNull();
    expect(await fixture.store.listSaveIds()).toEqual(["save"]);
  });
  it("preserves page selection and clamps keyboard navigation at the thirty-second slot", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "槽位 08 · 空白存档" }));
    await user.click(screen.getByRole("button", { name: "第 4 页，槽位 25 至 32" }));
    expect(screen.getByRole("button", { name: "槽位 32 · 空白存档" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "确认存档" })).toHaveTextContent("保存 32");
    await user.click(screen.getByRole("button", { name: "槽位 32 · 空白存档" }));
    await user.keyboard("{End}{ArrowDown}{PageDown}");
    expect(screen.getByRole("button", { name: "槽位 32 · 空白存档" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "槽位 25 · 空白存档" })).toHaveFocus();
    expect(await browserSaveSlots.read()).toBeNull();
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
    expect(screen.getByRole("button", { name: "槽位 05 · 空白存档" })).toHaveFocus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("button", { name: "槽位 13 · 空白存档" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "槽位 16 · 空白存档" })).toHaveFocus();
    await user.keyboard("{PageUp}");
    expect(screen.getByRole("button", { name: "槽位 08 · 空白存档" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "槽位 04 · 空白存档" })).toHaveFocus();
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
