import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MansionPage } from "./MansionPage";

describe("MansionPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts in the day phase and exposes the compact estate ledger", () => {
    render(<MansionPage />);

    expect(screen.getByRole("button", { name: "昼" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "与艾比希斯交谈" })).toBeInTheDocument();
    const ledger = screen.getByRole("region", { name: "领地账簿" });
    const stockButton = screen.getByRole("button", { name: /领地库存/ });
    expect(ledger).toBeInTheDocument();
    expect(ledger).not.toContainElement(stockButton);
    expect(stockButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/情绪平稳|核心结界/)).not.toBeInTheDocument();
  });

  it("opens a room detail drawer from its map region", async () => {
    const user = userEvent.setup();
    const { container } = render(<MansionPage />);
    const worldPan = container.querySelector<HTMLElement>(".mansion-world-pan");
    const initialTransform = worldPan?.style.transform;

    await user.click(screen.getByRole("button", { name: "查看大厅" }));

    const drawer = screen.getByRole("dialog", { name: "大厅" });
    expect(within(drawer).getByRole("heading", { name: "大厅" })).toBeInTheDocument();
    expect(within(drawer).getByText(/宅邸中庭，壁炉全年不熄/)).toBeInTheDocument();
    expect(within(drawer).getByRole("img", { name: "大厅房间预览" })).toBeInTheDocument();
    expect(drawer).toHaveAttribute("data-side", "right");
    expect(drawer.querySelector(".mansion-room-card")).toHaveAttribute("data-padding", "md");
    expect(worldPan?.style.transform).toContain("scale(1.45)");

    await user.click(within(drawer).getByRole("button", { name: "关闭房间详情" }));
    expect(worldPan?.style.transform).toBe(initialTransform);
  });

  it("places dorm and gate details on the left and toggles the same room closed", async () => {
    const user = userEvent.setup();
    const { container } = render(<MansionPage />);
    const worldPan = container.querySelector<HTMLElement>(".mansion-world-pan");
    const initialTransform = worldPan?.style.transform;
    const gate = screen.getByRole("button", { name: "查看正门" });

    await user.click(gate);
    expect(screen.getByRole("dialog", { name: "正门" })).toHaveAttribute("data-side", "left");
    expect(worldPan?.style.transform).toContain("scale(1.45)");

    await user.click(gate);
    expect(screen.queryByRole("dialog", { name: "正门" })).not.toBeInTheDocument();
    expect(worldPan?.style.transform).toBe(initialTransform);

    await user.click(screen.getByRole("button", { name: "查看尤斯缇丝的房间" }));
    expect(screen.getByRole("dialog", { name: "尤斯缇丝的房间" })).toHaveAttribute("data-side", "left");
  });

  it("moves residents when switching from day to dawn", async () => {
    const user = userEvent.setup();
    render(<MansionPage />);

    await user.click(screen.getByRole("button", { name: "查看小广场" }));
    let drawer = screen.getByRole("dialog", { name: "小广场" });
    expect(within(drawer).getByRole("img", { name: "尤斯缇丝" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "晨" }));

    expect(screen.getByRole("button", { name: "晨" })).toHaveAttribute("aria-pressed", "true");
    /* 相位说明小字已移除(当前时刻由高亮那一格表达),原先这里断言的是
       「炊烟升起，领地开始苏醒」。改为断言天数计数器 —— 直接点相位是预览,
       不推进天数,所以仍是第 1 天。 */
    expect(screen.getByLabelText("第 1 天")).toBeInTheDocument();
    drawer = screen.getByRole("dialog", { name: "小广场" });
    expect(within(drawer).getByText("无人驻在")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看尤斯缇丝的房间" }));
    drawer = screen.getByRole("dialog", { name: "尤斯缇丝的房间" });
    expect(within(drawer).getByRole("img", { name: "尤斯缇丝" })).toBeInTheDocument();
  });

  it("de-emphasizes only the residents of a hovered room", () => {
    const { container } = render(<MansionPage />);

    const kitchen = screen.getByRole("button", { name: "查看厨房" });
    const kael = screen.getByRole("button", { name: "与凯尔交谈" });
    const abyssa = screen.getByRole("button", { name: "与艾比希斯交谈" });
    const worldPan = container.querySelector<HTMLElement>(".mansion-world-pan");
    const initialTransform = worldPan?.style.transform;

    expect(kael).toHaveAttribute("data-room", "kitchen");
    fireEvent.pointerEnter(kitchen);
    expect(kael).toHaveClass("is-room-muted");
    expect(abyssa).not.toHaveClass("is-room-muted");
    expect(worldPan?.style.transform).toBe(initialTransform);

    fireEvent.pointerLeave(kitchen);
    expect(kael).not.toHaveClass("is-room-muted");
  });

  it("opens the shared ADV presentation and advances it without any gift UI", async () => {
    const user = userEvent.setup();
    render(<MansionPage />);

    const viewport = screen.getByRole("main", { name: "守望者之崖洋馆总览" });
    const setPointerCapture = vi.fn();
    Object.defineProperty(viewport, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture
    });

    expect(screen.queryByRole("region", { name: "随身礼物" })).not.toBeInTheDocument();
    const characterButton = screen.getByRole("button", { name: "与艾比希斯交谈" });
    fireEvent.pointerDown(characterButton, { button: 0, pointerId: 7, clientX: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 7, clientX: 150 });
    fireEvent.pointerUp(viewport, { pointerId: 7, clientX: 150 });

    expect(setPointerCapture).not.toHaveBeenCalled();
    await user.click(characterButton);

    expect(setPointerCapture).not.toHaveBeenCalled();
    const dialogue = screen.getByRole("dialog", { name: "与艾比希斯交谈" });
    expect(dialogue.querySelector('[data-character="abyssa"]')).toBeInTheDocument();
    expect(within(dialogue).getByText("ABYSSA BEELZERAN")).toBeInTheDocument();
    expect(screen.queryByText(/赠送|送礼/)).not.toBeInTheDocument();

    await user.click(dialogue);
    await waitFor(() => expect(dialogue).toHaveAttribute("data-state", "settled"));
    expect(within(dialogue).getByText("……勇者呢？")).toBeInTheDocument();

    await user.click(dialogue);
    expect(screen.queryByRole("dialog", { name: "与艾比希斯交谈" })).not.toBeInTheDocument();
  });

  it("charges each repair step and only offers the paid upgrade once progress is full", async () => {
    const user = userEvent.setup();
    render(<MansionPage />);

    await user.click(screen.getByRole("button", { name: "查看大厅" }));
    expect(screen.getByText("12,800")).toBeInTheDocument();

    /* 修缮不再一次升一级:每次推进 1 格进度,满 REPAIR_STEPS(3)格后才出现
       **付费**的升级键。逐步走完三步。 */
    for (let step = 1; step <= 3; step += 1) {
      await user.click(screen.getByRole("button", { name: "修缮，花费 960 金币" }));
      expect(screen.getByRole("button", { name: "修缮中，还需 1 相位" })).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "推进相位" }));
      const bar = screen.getByRole("progressbar", { name: `修缮进度 ${step}/3` });
      expect(bar).toHaveAttribute("aria-valuenow", String(step));
    }

    // 三次修缮共扣 2880:12,800 -> 9,920。档位仍是 Lv.2,没有自动升级。
    expect(screen.getByText("9,920")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "设施档位 · Lv.2" })).toBeInTheDocument();

    // 满格后修缮键让位给升级键,两者互斥。
    expect(screen.queryByRole("button", { name: "修缮，花费 960 金币" })).not.toBeInTheDocument();
    const promote = screen.getByRole("button", { name: "升级至 Lv.3，花费 1920 金币" });

    await user.click(promote);

    // 升级付 1920:9,920 -> 8,000。档位 +1,进度清零,修缮键回来。
    expect(screen.getByText("8,000")).toBeInTheDocument();
    const tier = screen.getByRole("progressbar", { name: "设施档位 · Lv.3" });
    expect(tier).toHaveAttribute("aria-valuenow", "3");
    expect(tier).toHaveAttribute("aria-valuemax", "4");
    expect(screen.getByRole("progressbar", { name: "修缮进度 0/3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "修缮，花费 960 金币" })).toBeEnabled();
  });

  it("counts a day only after all four phases elapse", async () => {
    const user = userEvent.setup();
    render(<MansionPage />);

    // 起始:昼、第 1 天。
    expect(screen.getByLabelText("第 1 天")).toBeInTheDocument();

    // 昼 -> 昏 -> 夜:仍是第 1 天,天数不跟着每次推进走。
    await user.click(screen.getByRole("button", { name: "推进相位" }));
    await user.click(screen.getByRole("button", { name: "推进相位" }));
    expect(screen.getByRole("button", { name: "夜" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("第 1 天")).toBeInTheDocument();

    // 夜 -> 晨 = 回绕,这一步才 +1 天。
    await user.click(screen.getByRole("button", { name: "推进相位" }));
    expect(screen.getByRole("button", { name: "晨" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("第 2 天")).toBeInTheDocument();
  });

  it("opens the estate stock as a modal inventory with fixed slots", async () => {
    const user = userEvent.setup();
    render(<MansionPage />);

    const stockButton = screen.getByRole("button", { name: /领地库存/ });
    expect(screen.queryByRole("dialog", { name: "领地库存" })).not.toBeInTheDocument();

    await user.click(stockButton);

    const dialog = screen.getByRole("dialog", { name: "领地库存" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // 固定 6x4 = 24 格,空槽也渲染 —— 这是背包与网页列表的根本差别。
    expect(within(dialog).getAllByRole("gridcell")).toHaveLength(24);
    expect(within(dialog).getByText(/尚未收取本轮产出/)).toBeInTheDocument();
    // 分类导轨带实时计数;分页恒在(单页时两键禁用),容量常驻。
    expect(within(dialog).getByRole("button", { name: "全部 0" })).toBeInTheDocument();
    expect(within(dialog).getByRole("navigation", { name: "物品栏分页" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "下一页" })).toBeDisabled();
    expect(within(dialog).getByText("48")).toBeInTheDocument();
  });

  it("returns focus to the stock button and collects production into a named item slot", async () => {
    const user = userEvent.setup();
    render(<MansionPage />);

    // 先收一份产出,库存才有东西。厨房产「热食」×2,靠世界图钉收取。
    await user.click(screen.getByRole("button", { name: "收取厨房的热食" }));

    const stockButton = screen.getByRole("button", { name: /领地库存/ });
    await user.click(stockButton);

    const dialog = screen.getByRole("dialog", { name: "领地库存" });
    // 物品身份来自 production.id,数量成为格位徽标而非行内文字。
    expect(within(dialog).getByRole("button", { name: /热食 2份/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "领地库存" })).not.toBeInTheDocument();
    });
    // Esc 关闭后焦点必须回到触发按钮,而不是丢到 body。
    await waitFor(() => expect(stockButton).toHaveFocus());
  });
});
