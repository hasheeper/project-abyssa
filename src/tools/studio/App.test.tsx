import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

describe("Sprite Studio", () => {
  it("keeps both seat controls connected to the exported parameter formats", () => {
    const { container } = render(<App />);
    const leftPanel = container.querySelector<HTMLElement>('.studio-panel[data-seat="left"]')!;

    expect(screen.getByRole("heading", { name: "立绘参数工作台" })).toBeInTheDocument();
    expect(container.querySelectorAll(".studio-panel")).toHaveLength(2);
    fireEvent.change(within(leftPanel).getAllByRole("spinbutton")[0]!, { target: { value: "1.1" } });
    fireEvent.click(screen.getByRole("button", { name: "导出" }));

    const dialog = screen.getByRole("dialog", { name: "导出参数" });
    expect((within(dialog).getByRole("textbox") as HTMLTextAreaElement).value).toContain("scale: 1.1,");

    fireEvent.click(within(dialog).getByRole("button", { name: "rp.css" }));
    expect((within(dialog).getByRole("textbox") as HTMLTextAreaElement).value).toContain("--abyssa-rp-doll-h");
    fireEvent.click(within(dialog).getByRole("button", { name: "emotes.ts" }));
    expect((within(dialog).getByRole("textbox") as HTMLTextAreaElement).value).toContain("EMOTE_PLACEMENT");
  });

  it("clears the copy feedback timer when the tool unmounts", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "导出" }));
    const timerCountBeforeCopy = vi.getTimerCount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制到剪贴板" }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(timerCountBeforeCopy + 1);
    unmount();
    expect(vi.getTimerCount()).toBe(timerCountBeforeCopy);
  });
});
