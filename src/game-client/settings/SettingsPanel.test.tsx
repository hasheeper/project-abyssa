import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import { setUiMotionPreference } from "../../shared/preferences/ui-motion";
afterEach(() => { cleanup(); setUiMotionPreference("system"); });

describe("in-scene settings layout", () => {
  it("uses the shared top tabs, a plain status and an unboxed reading preview", () => {
    const { container } = render(<SettingsPanel embedded onBack={vi.fn()} />);
    expect(screen.getByRole("main", { name: "系统设置" })).toHaveClass("settings-app--embedded");
    expect(screen.getByRole("tablist", { name: "设置分类" })).toHaveClass("abyssa-system-tabs");
    expect(screen.queryByRole("button", { name: "默认配置" })).toBeNull();
    expect(screen.getByText("默认配置")).toHaveClass("settings-config-state");
    expect(container.querySelector(".settings-side .settings-preview")).not.toBeNull();
    expect(screen.queryByRole("progressbar", { name: "Type speed" })).toBeNull();
    expect(screen.getByText("立绘取景")).toHaveClass("settings-side__label");
    expect(container.querySelector(".abyssa-frame")).toBeNull();
  });
  it("keeps preview controls and reset functional without applying them to gameplay", async () => {
    const onBack = vi.fn(), user = userEvent.setup();
    render(<SettingsPanel embedded onBack={onBack} />);
    fireEvent.change(screen.getByRole("slider", { name: "打字速度" }), { target: { value: "24" } });
    expect(screen.getByText("24ms · 42 字/秒")).toBeInTheDocument();
    expect(screen.getByText("已修改")).toHaveClass("settings-config-state");
    await user.click(screen.getByRole("button", { name: "全身" }));
    expect(screen.getByText("完整画布,人物会显得较小")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "恢复默认设置" }));
    expect(screen.getByRole("slider", { name: "打字速度" })).toHaveValue("13");
    expect(screen.getByRole("button", { name: "中距离" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("本页预览，尚未应用到游戏")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回" })); expect(onBack).toHaveBeenCalledOnce();
  });
  it("uses distinct radio states and clickable labels without nesting label elements", async () => {
    const user = userEvent.setup(); const { container } = render(<SettingsPanel embedded onBack={vi.fn()} />);
    const nvl = screen.getByRole("radio", { name: "NVL 分屏" });
    const adv = screen.getByRole("radio", { name: "ADV 对话" });
    expect(container.querySelector("label label")).toBeNull();
    expect(nvl).toBeChecked();
    expect(nvl.closest(".abyssa-choice")).toHaveAttribute("data-variant", "teal");
    expect(adv.closest(".abyssa-choice")).toHaveAttribute("data-variant", "gray");
    await user.click(screen.getByText("ADV 对话"));
    expect(adv).toBeChecked();
    expect(nvl).not.toBeChecked();
    expect(adv.closest(".abyssa-choice")).toHaveAttribute("data-variant", "teal");
    expect(nvl.closest(".abyssa-choice")).toHaveAttribute("data-variant", "gray");
    await user.click(screen.getByRole("button", { name: "恢复默认设置" }));
    expect(nvl).toBeChecked();
  });
  it("gives the remaining categories readable secondary headings without inventing connections", async () => {
    const user = userEvent.setup(); render(<SettingsPanel embedded onBack={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: "Display" }));
    expect(screen.getByText("显示状态")).toHaveClass("settings-side__label");
    await user.click(screen.getByRole("tab", { name: "Model" }));
    expect(screen.getByRole("heading", { name: "服务连接" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "模型分工" })).toBeInTheDocument();
    expect(screen.getByText("本机配置")).toHaveClass("settings-config-state");
    expect(screen.queryByText("本页未接入")).toBeNull();
    expect(screen.queryByRole("button", { name: "恢复默认设置" })).toBeNull();
    await user.click(screen.getByRole("tab", { name: "About" }));
    expect(screen.getByText("使用说明")).toHaveClass("settings-side__label");
  });
});
