import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import { DEFAULT_SETTINGS } from "../../game-client/settings/settings-state";
import { setUiMotionPreference } from "../../shared/preferences/ui-motion";
import { bindNavigator } from "../../shared/routing/location";

// Functional tests settle interpolation immediately; scene sequencing is covered separately.
vi.mock("motion/react", async original => ({ ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: { set: (n: number) => void }, target: number) => {
    value.set(target); return Object.assign(Promise.resolve(), { stop: vi.fn() });
  }),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); setUiMotionPreference("system"); });

describe("settings page", () => {
  it("uses the shared system shell and wires return and Escape", async () => {
    const navigate = vi.fn(() => true), unbind = bindNavigator(navigate);
    try {
      render(<SettingsPage />); const user = userEvent.setup();
      expect(document.querySelector(".abyssa-system-panel")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "返回" }));
      await waitFor(() => expect(navigate).toHaveBeenCalledWith("#/title", expect.any(Object)));
      await user.keyboard("{Escape}"); expect(navigate).toHaveBeenCalledTimes(1);
    } finally { unbind(); }
  });

  it("returns to the source save on Escape before a control receives focus, and releases its shortcut on unmount", async () => {
    const originalUrl = window.location.href;
    const navigate = vi.fn(() => true), unbind = bindNavigator(navigate);
    try {
      window.history.replaceState(null, "", "#/settings?from=menu&save=source-save&epoch=source-epoch");
      const { unmount } = render(<SettingsPage />);
      const dialog = screen.getByRole("dialog", { name: "系统设置" });
      fireEvent.keyDown(dialog, { key: "Escape", isComposing: true });
      fireEvent.keyDown(dialog, { key: "Escape", repeat: true });
      expect(navigate).not.toHaveBeenCalled();
      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith("#/menu?save=source-save&epoch=source-epoch", expect.any(Object)));
      unmount();
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(navigate).toHaveBeenCalledOnce();
    } finally { unbind(); window.history.replaceState(null, "", originalUrl); }
  });

  it("supports arrow keys between tabs and labels preview-only controls honestly", async () => {
    render(<SettingsPage />); const user = userEvent.setup();
    expect(screen.getByText("本页预览，尚未应用到游戏")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Scene" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Display" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Display" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}"); expect(screen.getByRole("tab", { name: "About" })).toHaveFocus();
  });
  it("reports failed persistence while keeping the selected session preference", async () => {
    const user = userEvent.setup(); render(<SettingsPage/>);
    await user.click(screen.getByRole("tab", { name: "Display" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const toggle = screen.getByRole("switch", { name: "减弱界面动效（关闭时跟随系统）" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/浏览器未能保存设置/)).toHaveAttribute("role", "status");
    expect(document.querySelector(".settings-app")).toHaveAttribute("data-ui-motion", "reduced");
  });
  it("exposes four categories with Scene selected first", () => {
    render(<SettingsPage />);

    const tablist = screen.getByRole("tablist", { name: "设置分类" });
    expect(tablist.querySelectorAll('[role="tab"]')).toHaveLength(4);
    for (const label of ["Scene", "Display", "Model", "About"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "Scene" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("uses the same unboxed scene heading and top tab band as Title LOAD", () => {
    const { container } = render(<SettingsPage />);

    const tablist = screen.getByRole("tablist", { name: "设置分类" });
    expect(tablist).toHaveClass("abyssa-system-tabs");
    expect(tablist.closest(".abyssa-system-panel__toolbar")).toBeInTheDocument();
    expect(container.querySelector(".abyssa-system-panel__body")?.contains(tablist)).toBe(false);
    expect(container.querySelector(".settings-app__frame, .abyssa-rpg-header")).toBeNull();
    expect(screen.getByRole("heading", { name: "系统设置SETTINGS" })).toHaveClass("system-scene__heading");
    expect(container.querySelectorAll(".abyssa-stage")).toHaveLength(1);
  });

  /* 打字速度与渐变柔和度必须是两个独立控件。
     它们正交(dur/step = 波宽),合并成单一「文本速度」会让
     「更快且更柔和」调不出来 —— 见 rp-typing.css 与 settings-state.ts。 */
  it("keeps typing speed and softness as two independent sliders", () => {
    render(<SettingsPage />);

    const step = screen.getByRole("slider", { name: "打字速度" });
    const dur = screen.getByRole("slider", { name: "渐变柔和度" });

    expect(step).toHaveValue(String(DEFAULT_SETTINGS.typeStep));
    expect(dur).toHaveValue(String(DEFAULT_SETTINGS.typeDur));
  });

  /* 默认值必须与下游实际值一致,否则设置页一挂载就静默改了演出参数。
     校对来源:rp-typing.css 的 13ms/340ms、rp App.tsx 的 2200/560。 */
  it("defaults mirror the live rp values", () => {
    expect(DEFAULT_SETTINGS.typeStep).toBe(13);
    expect(DEFAULT_SETTINGS.typeDur).toBe(340);
    expect(DEFAULT_SETTINGS.autoMs).toBe(2200);
    expect(DEFAULT_SETTINGS.morphMs).toBe(560);
  });

  /* 滑块改值用 fireEvent.change —— 那正是真实拖拽/按键最终派发的事件。
     不用 user.keyboard("{ArrowRight}"):jsdom 没有实现原生 range 的方向键
     步进,那条路径在这里恒为无操作,断言它等于断言了假象。
     键盘行为由浏览器原生提供(这也正是本控件基于 input[type=range] 而非
     自绘 div 的理由),属于需要真实浏览器验证的部分。 */
  it("disables 恢复默认设置 until something changed, then restores", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const reset = screen.getByRole("button", { name: "恢复默认设置" });
    expect(reset).toBeDisabled();

    const step = screen.getByRole("slider", { name: "打字速度" });
    fireEvent.change(step, { target: { value: "24" } });
    expect(step).toHaveValue("24");

    expect(reset).toBeEnabled();
    await user.click(reset);
    expect(step).toHaveValue(String(DEFAULT_SETTINGS.typeStep));
    expect(reset).toBeDisabled();
  });

  it("lets 减弱动态效果 take over the other motion switches", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("tab", { name: "Display" }));

    const reduced = screen.getByRole("switch", { name: "减弱界面动效（关闭时跟随系统）" });
    const bubbles = screen.getByRole("switch", { name: "气泡特效" });
    expect(bubbles).toBeEnabled();

    await user.click(reduced);
    expect(bubbles).toBeDisabled();
    // 背景底纹不是动效,不该被接管。
    expect(screen.getByRole("checkbox", { name: "背景底纹" })).toBeEnabled();
  });

  it("offers explicit direct configuration without claiming a tested connection", async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsPage />);

    await user.click(screen.getByRole("tab", { name: "Model" }));

    expect(container.querySelector('[aria-label="AIRP 浏览器直连设置"]')).toBeInTheDocument();
    expect(screen.getByLabelText("公共 API 地址")).toBeInTheDocument();
    expect(screen.getByLabelText("公共 API Key")).toHaveAttribute("type", "password");
    expect(screen.getByText(/导入文件不会调用模型/)).toBeInTheDocument();
    expect(screen.queryByText("连接成功")).not.toBeInTheDocument();
  });

  it("drops the backdrop texture when switched off", async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsPage />);
    const canvas = container.querySelector(".abyssa-stage__canvas");

    expect(canvas).toHaveStyle({ background: "var(--abyssa-system-backdrop)" });

    await user.click(screen.getByRole("tab", { name: "Display" }));
    await user.click(screen.getByRole("checkbox", { name: "背景底纹" }));

    expect(canvas).toHaveStyle({ background: "var(--abyssa-system-backdrop-plain)" });
  });

  /* 本页刻意不提供分辨率/全屏/音量之类没有下游的条目 ——
     固定画布架构下"分辨率"不是可调量,项目也没有任何音频代码。
     假开关比缺失更糟:它让人以为调了有用。 */
  it("does not invent settings without a downstream knob", () => {
    render(<SettingsPage />);

    for (const absent of ["分辨率", "全屏", "音量", "垂直同步"]) {
      expect(screen.queryByText(new RegExp(absent))).toBeNull();
    }
  });
});
