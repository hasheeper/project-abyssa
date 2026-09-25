import { indexedClientFixture as clientFixture } from "../../game-client/testing/indexed-client";
import { IDBFactory } from "fake-indexeddb";
let fixture: Awaited<ReturnType<typeof clientFixture>>;
vi.mock("../../game-client/title-save-list", () => ({ readTitleSaveList: vi.fn(() => fixture.runtime.application.list()) }));
vi.mock("../../game-runtime/browser", () => ({ createBrowserGameRuntime: () => fixture.runtime }));
vi.mock("../../game-client/react", async importOriginal => {
  const original = await importOriginal<typeof import("../../game-client/react")>();
  return { ...original, GameProvider: ({ children }: { children: React.ReactNode }) => <original.GameSessionScope session={fixture.session}>{children}</original.GameSessionScope> };
});
beforeEach(async () => { vi.stubGlobal("indexedDB", new IDBFactory()); fixture = await clientFixture({ start: false, initial: { clock: { day: 12, phase: "dusk" }, funds: { public: 12800, party: 1450, crystals: 8 } } }); });
afterEach(() => { fixture.session.dispose(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuPage } from "./MenuPage";
import { StrictMode } from "react";
import { readTitleSaveList } from "../../game-client/title-save-list";
vi.setConfig({ testTimeout: 15000 });

const settled = (view: string) => waitFor(() => {
  expect(document.querySelector(".menu-entry")).toHaveAttribute("data-menu-view", view);
  expect(document.querySelector(".menu-entry")).toHaveAttribute("data-menu-view-phase", "ready");
}, { timeout: 3500 });

afterEach(cleanup);

describe("MenuPage", () => {
  it("keeps the grid, page and selection mounted when switching LOAD to SAVE and back", async () => {
    const user = userEvent.setup(); const { container } = render(<MenuPage />);
    await user.click(screen.getByRole("button", { name: "读档" })); await settled("load");
    await user.click(screen.getByRole("button", { name: "第 2 页，槽位 11 至 20" }));
    await waitFor(() => expect(container.querySelector(".save-slots")).toHaveAttribute("data-slot-page-phase", "ready"), { timeout: 2500 });
    await user.click(screen.getByRole("button", { name: "槽位 14 · 空白存档" }));
    const grid = container.querySelector(".save-slots__grid"), rails = Array.from(container.querySelectorAll(".save-slots__rail"));
    const backdrop = container.querySelector(".menu-system-backdrop");
    expect(backdrop?.parentElement).toHaveClass("menu-content");
    const slot = screen.getByRole("button", { name: "槽位 14 · 空白存档" });
    const reads = vi.mocked(readTitleSaveList).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "存档" })); await settled("save");
    expect(container.querySelector(".save-slots__grid")).toBe(grid);
    expect(container.querySelector(".menu-system-backdrop")).toBe(backdrop);
    expect(backdrop).toHaveStyle({ opacity: "1" });
    expect(Array.from(container.querySelectorAll(".save-slots__rail"))).toEqual(rails);
    expect(screen.getByRole("button", { name: "槽位 14 · 空白存档" })).toBe(slot);
    expect(slot).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "确认存档" })).toHaveTextContent("保存 14");
    await user.click(screen.getByRole("button", { name: "读档" })); await settled("load");
    expect(container.querySelector(".save-slots__grid")).toBe(grid);
    expect(container.querySelector(".menu-system-backdrop")).toBe(backdrop);
    expect(screen.getByRole("button", { name: "读取所选档案" })).toHaveTextContent("读取 14");
    expect(vi.mocked(readTitleSaveList)).toHaveBeenCalledTimes(reads);
    expect(await fixture.store.listSaveIds()).toEqual(["save"]);
  });
  it("hosts settings without route handoff, remounting the Stage or replaying the home intro", async () => {
    const user = userEvent.setup(); const { container } = render(<MenuPage />);
    const stage = container.querySelector(".abyssa-stage__canvas");
    const entry = container.querySelector(".menu-entry");
    const backdrop = container.querySelector(".menu-system-backdrop");
    const sidebar = screen.getByRole("navigation", { name: "档案与设置" });
    await user.click(screen.getByRole("button", { name: /切换角色，当前艾比希斯/ }));
    await user.click(screen.getByRole("button", { name: "设置" }));
    expect(container.querySelector(".menu-content")).toHaveAttribute("inert");
    expect(sidebar).not.toHaveAttribute("inert");
    await settled("settings");
    expect(container.querySelector(".menu-system-backdrop")).toBe(backdrop);
    expect(backdrop).toHaveStyle({ opacity: "1" });
    expect(screen.getByRole("heading", { name: "设置 SETTINGS" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "系统设置" }).querySelector(".abyssa-frame")).toBeNull();
    expect(screen.getByRole("tablist", { name: "设置分类" })).toHaveClass("abyssa-system-tabs");
    expect(screen.getByRole("tablist", { name: "设置分类" }).closest(".abyssa-system-panel__tabs")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Scene" })).not.toHaveClass("abyssa-rpg-tab");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "主菜单" })).toBeNull();
    expect(screen.queryByLabelText("时间与相位")).toBeNull();
    expect(screen.queryByLabelText("持有资源")).toBeNull();
    expect(container.querySelector(".menu-home-controls")).toBeNull();
    expect(container.querySelector(".menu-backdrop")).toBeNull();
    expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase", "idle");
    expect(readTitleSaveList).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "返回" }));
    await settled("home");
    expect(container.querySelector(".menu-system-backdrop")).toBe(backdrop);
    expect(backdrop).toHaveStyle({ opacity: "0" });
    expect(screen.getByRole("button", { name: "设置" })).toHaveFocus();
    expect(container.querySelector(".abyssa-stage__canvas")).toBe(stage);
    expect(container.querySelector(".menu-entry")).toBe(entry);
    expect(screen.getByRole("navigation", { name: "档案与设置" })).toBe(sidebar);
    expect(entry).toHaveAttribute("data-menu-intro", "ready");
    expect(screen.getByRole("button", { name: /切换角色，当前玛丽埃塔/ })).toBeInTheDocument();
    expect(fixture.session.locator.saveId).toBe("save");
  });

  it("locks navigation while saving, releases on failure and allows retry", async () => {
    const user = userEvent.setup(); render(<MenuPage />);
    await user.click(screen.getByRole("button", { name: "存档" })); await settled("save");
    let reject!: (error: Error) => void;
    const gate = new Promise<never>((_, fail) => { reject = fail; });
    vi.spyOn(fixture.runtime.application, "exportSave").mockReturnValueOnce(gate);
    await user.click(screen.getByRole("button", { name: "槽位 02 · 空白存档" }));
    await user.click(screen.getByRole("button", { name: "确认存档" }));
    for (const label of ["存档", "读档", "设置", "返回主菜单"]) expect(screen.getByRole("button", { name: label })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".menu-entry")).toHaveAttribute("data-menu-view", "save");
    await act(async () => reject(new Error("暂时不可用")));
    expect(screen.getByRole("button", { name: "设置" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "重试存档" }));
    await waitFor(() => expect(screen.getByText("已保存至槽位 02")).toBeInTheDocument());
    expect(await fixture.store.listSaveIds()).toHaveLength(2);
  });

  it("can leave an initial archive scan, aborts it, and ignores its late result", async () => {
    const user = userEvent.setup(); render(<MenuPage />);
    let signal: AbortSignal | undefined;
    let finish!: (value: Awaited<ReturnType<typeof readTitleSaveList>>) => void;
    vi.mocked(readTitleSaveList).mockImplementationOnce(input => {
      signal = input; return new Promise(resolve => { finish = resolve; });
    });
    await user.click(screen.getByRole("button", { name: "读档" }));
    await waitFor(() => expect(document.querySelector(".menu-entry")).toHaveAttribute("data-menu-view", "load"), { timeout: 3500 });
    expect(document.querySelectorAll(".save-slots__rail")).toHaveLength(2);
    expect(document.querySelector(".save-slots")).toHaveAttribute("data-slot-waiting");
    expect(screen.queryByText("正在读取档案…")).toBeNull();
    expect(screen.getByRole("status", { name: "正在读取档案" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回主菜单" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "设置" })); await settled("settings");
    expect(signal?.aborted).toBe(true);
    await act(async () => finish(await fixture.runtime.application.list()));
    expect(screen.getByRole("main", { name: "系统设置" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "本机存档" })).toBeNull();
  });

  it("lets an archive utility consume Escape before returning from LOAD", async () => {
    const user = userEvent.setup(); render(<MenuPage />);
    await user.click(screen.getByRole("button", { name: "读档" })); await settled("load");
    await user.click(screen.getByRole("button", { name: "导入档案" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "导入档案" })).toBeNull();
    expect(document.querySelector(".menu-entry")).toHaveAttribute("data-menu-view", "load");
    await user.keyboard("{Escape}"); await settled("home");
  });
  it("exposes the four hub destinations and the six retained sidebar entries", () => {
    render(<MenuPage />);

    // 四角命令盘:府邸 / 角色 / 商店 / 出征。
    const dial = screen.getByRole("navigation", { name: "主菜单" });
    expect(within(dial).getAllByRole("button")).toHaveLength(4);
    for (const label of ["府邸", "角色", "商店", "出征"]) {
      expect(within(dial).getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    for (const displayLabel of ["MANOR", "ROSTER", "SHOP", "SORTIE"]) {
      expect(within(dial).getByText(displayLabel)).toBeInTheDocument();
    }
    // 角色迁到四键，左侧恢复成就占位；回顾仍不展示。
    const rail = screen.getByRole("navigation", { name: "档案与设置" });
    expect(within(rail).getAllByRole("button")).toHaveLength(6);
    expect(rail.querySelector(".abyssa-vertical-indicator")).toBeNull();
    for (const label of ["图鉴", "成就", "记忆", "存档", "读档", "设置"]) {
      expect(within(rail).getByRole("button", { name: label })).toBeInTheDocument();
      expect(within(rail).getByText(label)).toBeInTheDocument();
    }
  });

  it("opens SAVE without writing, confirms a separate local save and leaves the live campaign unchanged", async () => {
    render(<StrictMode><MenuPage /></StrictMode>); const user = userEvent.setup();
    const before = await fixture.runtime.application.open("save");
    await user.click(screen.getByRole("button", { name: "存档" }));
    await settled("save");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "存档 SAVE" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "保存档案" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "存档分页" })).toHaveClass("abyssa-system-tabs");
    expect(screen.getByRole("navigation", { name: "存档分页" }).closest(".abyssa-system-panel__tabs")).not.toBeNull();
    expect(screen.queryByText("另存一份本机档案；当前旅程继续自动保存。")).toBeNull();
    expect(screen.queryByText("不会覆盖或切换当前档案。")).toBeNull();
    expect(document.querySelector(".menu-entry")).not.toHaveAttribute("inert");
    expect(await fixture.store.listSaveIds()).toEqual(["save"]);
    await user.click(screen.getByRole("button", { name: "槽位 02 · 空白存档" }));
    await user.click(screen.getByRole("button", { name: "确认存档" }));
    await waitFor(() => expect(screen.getByText("已保存至槽位 02")).toBeInTheDocument());
    expect(await fixture.store.listSaveIds()).toHaveLength(2);
    expect(await fixture.runtime.application.open("save")).toEqual(before);
    expect(fixture.session.locator.saveId).toBe("save");
    expect(screen.getByRole("button", { name: "槽位 02 · 守望者之崖" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "返回主菜单" }));
    await settled("home");
    expect(document.querySelector(".menu-entry")).not.toHaveAttribute("inert");
  });

  it("cancels SAVE without creating an archive, and opens LOAD directly with a return to the menu", async () => {
    render(<MenuPage />); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "存档" }));
    await settled("save");
    await user.keyboard("{Escape}");
    await settled("home");
    expect(screen.getByRole("button", { name: "存档" })).toHaveFocus();
    expect(await fixture.store.listSaveIds()).toEqual(["save"]);
    await user.click(screen.getByRole("button", { name: "读档" }));
    await settled("load");
    await waitFor(() => expect(screen.getByRole("button", { name: "槽位 01 · 守望者之崖" })).toBeEnabled());
    expect(screen.getByRole("heading", { name: "读档 LOAD" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新的开始" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "返回主菜单" }));
    await settled("home");
    expect(await fixture.store.listSaveIds()).toEqual(["save"]);
  });

  it("shows day, phase and all three resources inside shared RPG frames", () => {
    const { container } = render(<MenuPage />);

    expect(screen.getByLabelText("第 12 天")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "当前相位 昏" })).toBeInTheDocument();
    // 三笔资源各自可读,金额走 CurrencyAmount 的 toLocaleString。
    expect(screen.getByLabelText("维稳公款 12800")).toBeInTheDocument();
    expect(screen.getByLabelText("小队资金 1450")).toBeInTheDocument();
    expect(screen.getByLabelText("远古晶石 8")).toBeInTheDocument();
    expect(screen.getByLabelText("时间与相位")).toHaveAttribute("data-side", "left");
    expect(screen.getByLabelText("持有资源")).toHaveAttribute("data-side", "right");
    expect(container.querySelectorAll(".menu-topbar .menu-hud-frame__art")).toHaveLength(2);
    expect(container.querySelectorAll(".menu-topbar .menu-hud-frame__outer")).toHaveLength(1);
    expect(container.querySelector(".menu-topbar .menu-hud-frame__funds-corner-edge")).not.toBeNull();
  });

  it("moves the dial selection without rendering a redundant hint line", async () => {
    const user = userEvent.setup();
    render(<MenuPage />);

    // 默认选中府邸。
    expect(screen.getByRole("button", { name: /府邸/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /出征/ }));

    expect(screen.getByRole("button", { name: /出征/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /府邸/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("编队并进入副本")).not.toBeInTheDocument();
  });

  /* 破窗设计的契约:立绘本身不被画框或名牌包住，切换入口放在左下控制台。 */
  it("renders the portrait without an inline frame and keeps switching in the scene console", () => {
    const { container } = render(<MenuPage />);

    const host = container.querySelector(".menu-app__host");
    expect(host).not.toBeNull();
    expect(host?.querySelector(".abyssa-frame")).toBeNull();
    expect(host?.querySelector(".abyssa-nameplate")).toBeNull();
    expect(host?.querySelector(".menu-host__figure")).not.toBeNull();
    // Photo, resident and controls are separate camera planes; the Stage stays put.
    expect(container.querySelector(".menu-entry > .menu-scenery")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".menu-entry > .menu-scenery-shade")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".menu-home > .menu-host__fade")).not.toBeNull();
    expect(host).not.toContainElement(container.querySelector(".menu-host__fade"));
    const characterSwitch = screen.getByRole("button", { name: /切换角色，当前艾比希斯，5\/9/ });
    expect(host).not.toContainElement(characterSwitch);
    expect(screen.getByRole("button", { name: /切换背景，当前月下长廊，1\/1/ })).toBeInTheDocument();
  });

  it("cycles the resident character from the bottom-left console", async () => {
    const user = userEvent.setup();
    const { container } = render(<MenuPage />);

    await user.click(screen.getByRole("button", { name: /切换角色，当前艾比希斯，5\/9/ }));

    expect(screen.getByRole("button", { name: /切换角色，当前玛丽埃塔/ })).toBeInTheDocument();
    expect(container.querySelector<HTMLImageElement>(".menu-host__figure")?.alt).toContain("玛丽埃塔");
  });

  /* 角色在四键内沿用先选中、再确认进入原页面的交互。 */
  it("opens the character archive when the roster entry is confirmed", async () => {
    const user = userEvent.setup();
    const { container } = render(<MenuPage />);

    const roster = within(screen.getByRole("navigation", { name: "主菜单" })).getByRole("button", { name: "角色 · 查看角色档案" });
    await user.click(roster);

    // 第一次只选中并开始打字，黑幕不动；等待对白完整呈现。
    expect(roster).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("想看谁的档案？")).toBeInTheDocument();
    expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase", "idle");

    await user.click(roster);

    // 第二次:黑幕闭合并报出目的地。
    expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase", "closing");
    expect(screen.getByText("角色档案")).toBeInTheDocument();
    expect(screen.getByText("正在翻阅")).toBeInTheDocument();
  });

  /* 没有目标页的条目仍是纯占位:点两次也不许拉黑幕。 */
  it.each(["图鉴", "成就", "记忆"])("keeps the %s placeholder on the menu after repeated clicks", async label => {
    const user = userEvent.setup();
    const { container } = render(<MenuPage />);

    const codex = screen.getByRole("button", { name: label });
    await user.click(codex);
    await user.click(codex);

    expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase", "idle");
  });

  it("places the host dialogue below the command dial instead of over the portrait", () => {
    const { container } = render(<MenuPage />);

    const dialogue = screen.getByRole("region", { name: /的对话/ });
    expect(container.querySelector(".menu-app__dial")).toContainElement(dialogue);
    expect(container.querySelector(".menu-app__host")).not.toContainElement(dialogue);
    expect(dialogue).toHaveAttribute("data-nameplate", "true");
    expect(within(dialogue).getByText("艾比希斯")).toBeInTheDocument();
    expect(within(dialogue).getByText("ABYSSA BEELZERAN")).toBeInTheDocument();
    expect(container.querySelector(".menu-app__dial-hint")).toBeNull();
  });
});
