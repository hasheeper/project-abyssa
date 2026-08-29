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

  it("starts in the day phase and uses Abyssa's canonical Chinese name", () => {
    render(<MansionPage />);

    expect(screen.getByRole("button", { name: "昼" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "与艾比希斯交谈" })).toBeInTheDocument();
    expect(screen.getByText("艾比希斯 · 情绪平稳")).toBeInTheDocument();
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
    expect(screen.getByText("炊烟升起，领地开始苏醒")).toBeInTheDocument();
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

  it("deducts the correct fund and completes a repair after two phase advances", async () => {
    const user = userEvent.setup();
    render(<MansionPage />);

    await user.click(screen.getByRole("button", { name: "查看大厅" }));
    expect(screen.getByText("12,800")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "修缮，花费 960 金币" }));

    expect(screen.getByText("11,840")).toBeInTheDocument();
    expect(screen.getByText("1,450")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "修缮中，还需 2 相位" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "推进相位" }));
    expect(screen.getByRole("button", { name: "修缮中，还需 1 相位" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "推进相位" }));
    expect(screen.getByRole("progressbar", { name: "设施档位 · Lv.3" })).toHaveAttribute(
      "aria-valuenow",
      "75"
    );
    expect(screen.getByRole("button", { name: "修缮，花费 960 金币" })).toBeEnabled();
    expect(screen.getByText("11,840")).toBeInTheDocument();
  });
});
