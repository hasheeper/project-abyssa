import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitleArchive } from "./TitleArchive";
import type { useTitleArchive } from "./useTitleArchive";
import type { PlayerSaveListEntry } from "../../game-runtime/player-runtime";
import { newGameFixture } from "../../game-client/testing/new-game";
import { rememberSave } from "../../game-client/navigation";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { browserSaveSlots } from "../../game-runtime/save-slots";

type Archive = ReturnType<typeof useTitleArchive>;
let saves: PlayerSaveListEntry[];
beforeEach(async () => {
  localStorage.clear();
  const { runtime } = newGameFixture();
  for (const [index, startAt] of (["prologue", "first-morning", "tutorial", "hub"] as const).entries()) {
    const result = await runtime.application.createNewGame({ saveId: `save-${index}`, epoch: `epoch-${index}`, clientRequestId: `request-${index}`, startAt, playerName: `旅人${index}` });
    if (!result.ok) throw new Error(result.error.message);
  }
  const result = await runtime.application.list();
  if (!result.ok) throw new Error(result.error.message);
  saves = result.saves;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function controller(overrides: Partial<Archive> = {}): Archive {
  return { saves, busy: false, operationBusy: false, setInteractionBusy: vi.fn(), removeFromList: vi.fn(), message: "", listState: "ready", open: true, setOpen: vi.fn(), pendingNewGame: null,
    archivedIds: new Set(), showArchived: false, setShowArchived: vi.fn(), cleanup: vi.fn(), restore: vi.fn(), choose: vi.fn(), continueGame: vi.fn(),
    newGame: vi.fn(), importGame: vi.fn(), continueSave: vi.fn(), exportGame: vi.fn(), refresh: vi.fn(), ...overrides };
}
const mount = (archive: Archive, onNewGame = vi.fn()) => render(<TitleArchive archive={archive} onNewGame={onNewGame} onPresentChange={() => {}} />,
  { wrapper: ({ children }) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider> });

describe("player load archive", () => {
  it("shows open archive rails and a bilingual heading, with icon tools instead of the old window", async () => {
    mount(controller());
    await waitFor(() => expect(screen.getByRole("dialog", { name: "读取档案" })).toBeVisible());
    expect(screen.getAllByRole("button", { name: /^选择档案 / })).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: /^选择档案 / }).map(option => option.textContent)).toEqual([
      expect.stringContaining("序章"), expect.stringContaining("退潮岩窟"), expect.stringContaining("洋馆的清晨"), expect.stringContaining("守望者之崖"),
    ]);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("旅人0");
    expect(screen.queryByText(/AIRP/)).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "导出诊断" })).toBeNull();
    expect(screen.getByRole("button", { name: "导入档案" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "读取档案LOAD" })).toBeInTheDocument();
    expect(document.querySelectorAll(".save-slots__rail")).toHaveLength(2);
    expect(document.querySelector(".abyssa-rpg-header, .abyssa-system-panel__frame")).toBeNull();
    expect(screen.getByRole("button", { name: "导入档案" })).toHaveTextContent("");
    expect(document.querySelector(".abyssa-system-panel")).toBeInTheDocument();
    for (const text of ["本机档案 · 4", "选择要继续的旅程", "最近游玩", "洋馆 · 自由行动", "Esc 返回档案"]) expect(screen.queryByText(text)).toBeNull();
    expect(screen.getAllByRole("button", { name: /^选择档案 / })[0]).toHaveTextContent("第 1 天");
    for (const image of document.querySelectorAll(".save-slots__image img")) expect(image).toHaveAttribute("loading", "lazy");
  });

  it("promotes only the exact recent identity, supports arrows/Home/End and reads the selected save on Enter", async () => {
    rememberSave({ saveId: "save-2", epoch: "epoch-2" });
    const archive = controller(); mount(archive);
    const options = screen.getAllByRole("button", { name: /^选择档案 / });
    expect(options[0]).toHaveTextContent("旅人2");
    expect(options[0]).toHaveAttribute("aria-pressed", "true");
    await userEvent.setup().click(options[0]);
    fireEvent.keyDown(options[0], { key: "ArrowRight" });
    expect(options[1]).toHaveFocus();
    expect(options[1]).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(options[1], { key: "End" });
    expect(options[3]).toHaveFocus();
    fireEvent.keyDown(options[3], { key: "Home" });
    expect(options[0]).toHaveFocus();
    fireEvent.keyDown(options[0], { key: "Enter", repeat: true });
    expect(archive.choose).not.toHaveBeenCalled();
    fireEvent.keyDown(options[0], { key: "Enter" });
    expect(archive.choose).toHaveBeenCalledExactlyOnceWith({ saveId: "save-2", epoch: "epoch-2" });
  });

  it("does not promote a different epoch as recent; a refreshed list cannot leave a dangling selection", async () => {
    rememberSave({ saveId: "save-2", epoch: "different-epoch" });
    const archive = controller(), view = mount(archive);
    expect(screen.getAllByRole("button", { name: /^选择档案 / })[0]).toHaveTextContent("旅人0");
    await userEvent.setup().click(screen.getAllByRole("button", { name: /^选择档案 / })[3]);
    view.rerender(<TitleArchive archive={{ ...archive, saves: saves.slice(0, 2) }} onNewGame={() => {}} onPresentChange={() => {}} />);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("旅人0");
  });

  it("paginates beyond thirty records and moves focus across pages without scrolling the Stage", async () => {
    const source = saves[0]; if (source.status !== "ready") throw new Error("fixture");
    const many = Array.from({ length: 35 }, (_, n) => ({ ...source, saveId: `record-${n}`,
      presentation: { ...source.presentation!, playerName: `旅人${n}` }, summary: { ...source.summary, head: { ...source.summary.head, saveId: `record-${n}` } } }));
    mount(controller({ saves: many }));
    expect(screen.getAllByRole("button", { name: /^选择档案 / })).toHaveLength(8);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    fireEvent.keyDown(screen.getByRole("button", { pressed: true }), { key: "End" });
    await waitFor(() => expect(screen.getByRole("list", { name: "本机存档 · 第 5 页" })).toBeInTheDocument());
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("旅人34");
    expect(screen.getByRole("button", { pressed: true })).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    fireEvent.keyDown(screen.getByRole("button", { pressed: true }), { key: "Home" });
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("旅人0");
    expect(screen.getByRole("button", { pressed: true })).toHaveFocus();
    expect(screen.getByRole("list").scrollTop).toBe(0);
  });

  it("exports the hovered record directly without changing the selected record or opening management", async () => {
    const archive = controller(); mount(archive);
    const user = userEvent.setup();
    const row = screen.getAllByRole("listitem")[1];
    await user.hover(row);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("旅人0");
    const exportButton = within(row).getByRole("button", { name: "导出存档" });
    expect(exportButton.textContent).toBe("");
    // user-event's mouse movement omits relatedTarget; model this parent-to-child
    // transition explicitly so it does not fake a departure from the entire row.
    fireEvent.mouseOut(row, { relatedTarget: exportButton });
    fireEvent.mouseOver(exportButton, { relatedTarget: row });
    await userEvent.setup({ skipHover: true }).click(exportButton);
    expect(archive.exportGame).toHaveBeenCalledExactlyOnceWith("save-2", false);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("旅人0");
    expect(screen.queryByRole("region", { name: "档案管理" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "导入档案" }));
    expect(within(row).queryByRole("button", { name: "导出存档" })).toBeNull();
  });

  it("offers a designed empty state without fake slots or creating a save", async () => {
    const archive = controller({ saves: [] }), start = vi.fn(); mount(archive, start);
    await waitFor(() => expect(screen.getByText("尚未留下旅程记录")).toBeVisible());
    expect(screen.queryByRole("button", { name: /^选择档案 / })).toBeNull();
    expect(screen.queryByRole("button", { name: "读取所选档案" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "新的开始" }));
    expect(archive.setOpen).toHaveBeenCalledWith(false);
    expect(start).not.toHaveBeenCalled(); // Setup opens only after the archive has exited.
    expect(archive.newGame).not.toHaveBeenCalled();
  });

  it.each(["loading", "error"] as const)("distinguishes %s from an empty directory", async state => {
    mount(controller({ saves: [], listState: state, busy: state === "loading" }));
    expect(screen.queryByText("尚未留下旅程记录")).toBeNull();
    if (state === "loading") expect(screen.getByRole("status", { name: "正在读取档案" })).toBeInTheDocument();
    else expect(screen.getByText("暂时无法读取本机档案")).toBeVisible();
    expect(screen.queryByRole("button", { name: "新的开始" })).toBeNull();
    if (state === "error") expect(screen.getByRole("button", { name: "重新读取档案" })).toBeEnabled();
  });

  it("preserves unavailable entries for diagnostics, without allowing them to load", async () => {
    const broken: PlayerSaveListEntry = { status: "unavailable", saveId: "broken", error: { code: "not-found", path: "save", message: "missing" } };
    const archive = controller({ saves: [...saves, broken] }); mount(archive);
    const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: /暂不可读取/ }));
    expect(screen.getByRole("button", { name: "读取所选档案" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "档案管理" }));
    expect(screen.queryByRole("button", { name: "导出存档" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "导出诊断" }));
    expect(archive.exportGame).toHaveBeenCalledExactlyOnceWith("broken", true);
  });

  it("requires archived saves to be restored through management and returns to the list with Escape", async () => {
    const archive = controller({ archivedIds: new Set(["save-0"]), showArchived: true }); mount(archive);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "读取所选档案" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "档案管理" }));
    await user.click(screen.getByRole("button", { name: "恢复档案" }));
    expect(archive.restore).toHaveBeenCalledExactlyOnceWith("save-0");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("list")).toBeVisible(); expect(archive.setOpen).not.toHaveBeenCalled();
  });

  it("opens import on the same content plane, submits the selected file and clears the input for retry", async () => {
    const archive = controller(); mount(archive); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "导入档案" }));
    expect(screen.queryByRole("list")).toBeNull();
    await user.selectOptions(screen.getByRole("combobox", { name: "导入格式" }), "restore");
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    const input = screen.getByLabelText("导入存档");
    fireEvent.change(input, { target: { files: [file] } });
    expect(archive.importGame).toHaveBeenCalledExactlyOnceWith(file, "restore");
    expect(input).toHaveValue("");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("list")).toBeVisible();
  });

  it("keeps the archived filter in management and returns to the list after changing it", async () => {
    const archive = controller({ archivedIds: new Set(["archived-save"]), showArchived: false }); mount(archive);
    const user = userEvent.setup();
    expect(screen.queryByRole("button", { name: /显示已归档/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "档案管理" }));
    await user.click(screen.getByRole("button", { name: "显示已归档（1）" }));
    expect(archive.setShowArchived).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole("list")).toBeVisible();
  });

  it("keeps focus inside each utility page and restores the selection on the first Escape", async () => {
    const archive = controller(); mount(archive); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "选择档案 退潮岩窟 · 旅人2" }));
    await user.click(screen.getByRole("button", { name: "档案管理" }));
    expect(screen.getByRole("heading", { name: "档案管理" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "导入档案" }));
    expect(screen.getByRole("heading", { name: "导入档案" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("旅人2");
    expect(screen.getByRole("button", { pressed: true })).toHaveFocus();
    expect(archive.setOpen).not.toHaveBeenCalled();
  });

  it("locks operations and closing while a read/import is in progress and shows errors inside the modal", () => {
    const archive = controller({ busy: true, message: "存储空间不足" }); mount(archive);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent("存储空间不足");
    for (const button of dialog.querySelectorAll("button")) expect(button).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(archive.setOpen).not.toHaveBeenCalled();
  });

  it("keeps a stable thumbnail fallback after an image fails", () => {
    mount(controller());
    const image = document.querySelector(".save-slots__image img")!;
    fireEvent.error(image);
    expect(document.querySelector(".save-slots__image")).toHaveTextContent("场景预览");
    expect(screen.getByRole("button", { name: "读取所选档案" })).toBeEnabled();
  });

  it("uses only real manual-save dates from the same identity and never synthesizes dates for old records", async () => {
    vi.spyOn(browserSaveSlots, "read").mockResolvedValue({ version: 1, revision: 1, slots: Array.from({ length: 30 }, (_, n) => n === 0
      ? { saveId: "save-0", epoch: "epoch-0", savedAt: "2026-09-19T10:35:00.000Z" }
      : n === 1 ? { saveId: "save-1", epoch: "wrong-epoch", savedAt: "2026-09-18T10:35:00.000Z" } : null) });
    mount(controller());
    await waitFor(() => expect(document.querySelector('time[datetime="2026-09-19T10:35:00.000Z"]')).toBeInTheDocument());
    expect(document.querySelectorAll("time[datetime]")).toHaveLength(1);
    expect(screen.getAllByText("时间未记录")).toHaveLength(3);
  });
});
