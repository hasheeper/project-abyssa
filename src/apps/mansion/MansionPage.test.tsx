import { clientFixture } from "../../game-client/testing/helpers";
let fixture: Awaited<ReturnType<typeof clientFixture>>;
vi.mock("../../game-client/react", async importOriginal => {
  const original = await importOriginal<typeof import("../../game-client/react")>();
  return { ...original, GameProvider: ({ children }: { children: React.ReactNode }) => <original.GameSessionScope session={fixture.session}>{children}</original.GameSessionScope> };
});
beforeEach(async () => { fixture = await clientFixture({ start: false, initial: { clock: { day: 1, phase: "day" }, funds: { public: 12800, party: 1450, crystals: 8 } } }); });
afterEach(() => fixture.session.dispose());
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

  it("uses campaign phase and disables manual time changes", async () => {
    const user = userEvent.setup(); render(<MansionPage />);
    const before = fixture.session.getSnapshot().record;
    await user.click(screen.getByRole("button", { name: "晨" }));
    expect(screen.getByRole("button", { name: "晨" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "昼" })).toHaveAttribute("aria-pressed", "true");
    expect(fixture.session.getSnapshot().record).toBe(before);
  });

  it("de-emphasizes only the residents of a hovered room", () => {
    const { container } = render(<MansionPage />);

    const kitchen = screen.getByRole("button", { name: /查看女仆工作间/ });
    const marietta = screen.getByRole("button", { name: "与玛丽埃塔交谈" });
    const abyssa = screen.getByRole("button", { name: "与艾比希斯交谈" });
    const worldPan = container.querySelector<HTMLElement>(".mansion-world-pan");
    const initialTransform = worldPan?.style.transform;

    expect(marietta).toHaveAttribute("data-room", "maid");
    fireEvent.pointerEnter(kitchen);
    expect(marietta).toHaveClass("is-room-muted");
    expect(abyssa).not.toHaveClass("is-room-muted");
    expect(worldPan?.style.transform).toBe(initialTransform);

    fireEvent.pointerLeave(kitchen);
    expect(marietta).not.toHaveClass("is-room-muted");
    expect(screen.queryByRole("button", {name:/与凯尔交谈/})).not.toBeInTheDocument();
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

  it("disables unimplemented repairs and leaves real funds unchanged", async () => {
    const user = userEvent.setup(); render(<MansionPage />);
    await user.click(screen.getByRole("button", { name: "查看大厅" }));
    const repair = screen.getByRole("button", { name: /修缮，花费/ });
    expect(repair).toBeDisabled(); await user.click(repair);
    expect(fixture.session.getSnapshot().record!.snapshot.campaign.funds.public).toBe(12800);
    expect(screen.getAllByText("建设与生产尚未开放").length).toBeGreaterThan(0);
  });

  it("does not expose prototype production or advance the campaign clock", async () => {
    render(<MansionPage />);
    expect(screen.getByRole("button", { name: "推进相位" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "收取厨房的热食" })).not.toBeInTheDocument();
    expect(fixture.session.getSnapshot().record!.snapshot.campaign.clock).toEqual({ day: 1, phase: "day" });
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
    expect(within(dialog).getByText(/营地暂无物品/)).toBeInTheDocument();
    // 分类导轨带实时计数;分页恒在(单页时两键禁用),容量常驻。
    expect(within(dialog).getByRole("button", { name: "全部 0" })).toBeInTheDocument();
    expect(within(dialog).getByRole("navigation", { name: "物品栏分页" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "下一页" })).toBeDisabled();
    expect(within(dialog).getByText("32")).toBeInTheDocument();
  });

  it("returns focus to the stock button after closing the real inventory", async () => {
    const user = userEvent.setup();
    render(<MansionPage />);

    const stockButton = screen.getByRole("button", { name: /领地库存/ });
    await user.click(stockButton);

    const dialog = screen.getByRole("dialog", { name: "领地库存" });
    expect(within(dialog).getByText(/营地暂无物品/)).toBeInTheDocument();

    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "领地库存" })).not.toBeInTheDocument();
    });
    // Esc 关闭后焦点必须回到触发按钮,而不是丢到 body。
    await waitFor(() => expect(stockButton).toHaveFocus());
  });
});
