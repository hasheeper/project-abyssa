import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsPage } from "./SettingsPage";
import { DEFAULT_SETTINGS } from "./settings-state";

afterEach(cleanup);

describe("settings page", () => {
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

  /* 页签必须在顶部横排,不能挪到侧栏。
     RpgTab 的路径是上两角圆、下沿平口不闭合 —— 它是「坐在面板顶上」的
     形状,靠 margin-bottom 负值与画框顶边接缝。竖排会让平口朝侧面,
     形状语义整个错位(初版就是这么错的)。
     结构判据:tablist 是画框的**兄长**且排在其前,而非画框内部的一列。 */
  it("keeps the tab strip above the frame, not in a side rail", () => {
    const { container } = render(<SettingsPage />);

    const tablist = screen.getByRole("tablist", { name: "设置分类" });
    const frame = container.querySelector(".settings-app__frame");

    expect(tablist.parentElement).toBe(frame?.parentElement);
    expect(tablist.compareDocumentPosition(frame!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    // 页签不得落在画框内部。
    expect(frame?.contains(tablist)).toBe(false);
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

    const reduced = screen.getByRole("switch", { name: "减弱动态效果" });
    const bubbles = screen.getByRole("switch", { name: "气泡特效" });
    expect(bubbles).toBeEnabled();

    await user.click(reduced);
    expect(bubbles).toBeDisabled();
    // 背景底纹不是动效,不该被接管。
    expect(screen.getByRole("checkbox", { name: "背景底纹" })).toBeEnabled();
  });

  /* AI 服务后端契约未对齐,这一栏必须保持不可配置。
     具体的表单形状会把错的心智模型固化下来(密钥属于本机作用域的
     Provider Connection,不是"填个 API Key"那么单层)。 */
  it("keeps the model tab inert while the backend contract is open", async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsPage />);

    await user.click(screen.getByRole("tab", { name: "Model" }));

    const panel = container.querySelector(".settings-app__panel");
    expect(panel?.querySelectorAll("input")).toHaveLength(0);
    expect(panel?.querySelectorAll("button")).toHaveLength(0);
  });

  it("drops the backdrop texture when switched off", async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsPage />);
    const canvas = container.querySelector(".abyssa-stage__canvas");

    expect(canvas).toHaveStyle({ background: "var(--settings-backdrop)" });

    await user.click(screen.getByRole("tab", { name: "Display" }));
    await user.click(screen.getByRole("checkbox", { name: "背景底纹" }));

    expect(canvas).toHaveStyle({ background: "var(--settings-backdrop-plain)" });
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
