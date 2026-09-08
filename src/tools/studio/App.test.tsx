import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { buildDefaults, buildEmoteDefaults, formatJson, STORAGE_KEY } from "./params";

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
  it("uses the saved calibration in emotion mode and preserves it when returning to the original editor", () => {
    vi.useFakeTimers();
    const params = buildDefaults(), emotes = buildEmoteDefaults();
    params.eustice.cal = {scale:0.91,x:0.012,y:-0.03};
    emotes.base.anger = {x:7,y:16,size:30};
    emotes.adjust.eustice = {anger:{x:3,y:2,size:4}};
    localStorage.setItem(STORAGE_KEY,formatJson(params,emotes));
    const {container} = render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"情绪联动"}));
    fireEvent.click(within(screen.getByRole("region",{name:"左侧情绪"})).getByRole("button",{name:"不悦"}));
    act(()=>vi.advanceTimersByTime(100));
    const bubble = container.querySelector<HTMLElement>(".emotion-actor__bubble")!;
    expect(["x","y","size"].map(k=>bubble.style.getPropertyValue(`--abyssa-emote-${k}`))).toEqual(["10%","18%","34%"]);
    expect(container.querySelector('[data-character="eustice"] .abyssa-paper-doll__calibration')).toHaveStyle({transform:"translate(1.2%, -3%) scale(0.91)"});
    fireEvent.click(screen.getByRole("button",{name:"返回参数工作台"}));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).characters.eustice.cal).toEqual(params.eustice.cal);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).emotes.adjust.eustice).toEqual(emotes.adjust.eustice);
  });
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
