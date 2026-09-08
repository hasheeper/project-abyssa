import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitleCgPanel } from "./TitleCgPanel";
import { TITLE_CG_FRAMES } from "./titleCg";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const mount = () => render(<TitleCgPanel side="left" initialDelayMs={6200} dwellMs={8800} fadeMs={1150} step={1} />);
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("title CG playback", () => {
  it("keeps the old frame until decoding finishes and releases it after the original crossfade", async () => {
    const { container } = mount();
    const active = () => container.querySelector<HTMLImageElement>("[data-active]")!;
    expect(container.querySelectorAll("img")).toHaveLength(1);
    await advance(4700);
    expect(container.querySelectorAll("img")).toHaveLength(2);
    const next = container.querySelector<HTMLImageElement>("img:not([data-active])")!;
    let decoded!: () => void;
    next.decode = vi.fn(() => new Promise<void>(resolve => { decoded = resolve; }));
    fireEvent.load(next);
    await advance(2000); // A slow decode must not replace a ready image with an empty one.
    expect(active().getAttribute("src")).toBe(TITLE_CG_FRAMES[0].src);
    await act(async () => decoded());
    await advance(32);
    expect(active()).toBe(next);
    expect(container.querySelectorAll("img")).toHaveLength(2);
    await advance(1150);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(active()).toBe(next);
    await advance(8800 - 1500 - 1150);
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("keeps the current image when the next image fails, then tries the following frame", async () => {
    const { container } = mount();
    await advance(4700);
    fireEvent.error(container.querySelector("img:not([data-active])")!);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(TITLE_CG_FRAMES[0].src);
    await advance(7300);
    expect(container.querySelector("img:not([data-active])")?.getAttribute("src")).toBe(TITLE_CG_FRAMES[2].src);
  });

  it("cancels pending playback when leaving the title", async () => {
    const { unmount } = mount();
    await advance(4700);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
