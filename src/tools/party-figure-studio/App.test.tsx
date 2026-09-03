import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clonePartyFigureCalibrations,
  stringifyPartyFigureCalibrationJson
} from "../../content/characters/partyFigureCalibration";
import { partyFigureCatalog } from "../../assets/map/party-figures/catalog";
import { App } from "./App";
import { PARTY_FIGURE_STORAGE_KEY } from "./party-figure-model";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

describe("Party Figure Studio", () => {
  it("connects all ten figures, backgrounds and comparison mode", () => {
    const { container } = render(<App />);
    const roster = screen.getByLabelText("十人立绘名册");

    expect(screen.getByRole("heading", { name: "队伍立绘对齐工作台" })).toBeInTheDocument();
    expect(within(roster).getAllByRole("checkbox")).toHaveLength(10);
    expect(partyFigureCatalog).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "五人编队" }));
    expect(screen.getByLabelText("五人编队对比预览")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^编辑 / })).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "羊皮纸" }));
    expect(container.querySelector('[data-background="parchment"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "网格" }));
    expect(container.querySelector('[data-background="grid"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "隐藏基线" }));
    expect(container.querySelector('[data-guide="baseline"]')).not.toBeInTheDocument();
  });

  it("updates only the selected figure and exports stable JSON and TypeScript", async () => {
    render(<App />);
    const inspector = screen.getByLabelText("当前立绘参数");
    const fields = within(inspector).getAllByRole("spinbutton");

    fireEvent.change(fields[0], { target: { value: "1.05" } });
    fireEvent.change(fields[1], { target: { value: "2.5" } });
    fireEvent.change(fields[2], { target: { value: "3" } });
    fireEvent.click(within(inspector).getByRole("checkbox", { name: /水平翻转/ }));

    fireEvent.click(screen.getByRole("button", { name: "导出参数" }));
    const dialog = screen.getByRole("dialog", { name: "导出校准参数" });
    const json = (within(dialog).getByRole("textbox") as HTMLTextAreaElement).value;
    const parsed = JSON.parse(json);
    expect(parsed.abyssa).toEqual({ scale: 1.05, x: 2.5, y: 3, flipX: true });
    expect(parsed.alvitr.scale).toBe(1.11);

    fireEvent.click(within(dialog).getByRole("button", { name: "TypeScript" }));
    expect((within(dialog).getByRole("textbox") as HTMLTextAreaElement).value).toContain(
      "export const partyFigureCalibrations ="
    );

    await waitFor(() => expect(localStorage.getItem(PARTY_FIGURE_STORAGE_KEY)).toContain(
      '"scale": 1.05'
    ));
  });

  it("imports a pasted snapshot and restores it from local storage", async () => {
    const imported = clonePartyFigureCalibrations();
    imported.abyssa = { scale: 0.9, x: -2, y: 1.5, flipX: false };
    const source = stringifyPartyFigureCalibrationJson(imported);

    const first = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "粘贴导入" }));
    const dialog = screen.getByRole("dialog", { name: "导入校准参数" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: source } });
    fireEvent.click(within(dialog).getByRole("button", { name: "应用导入" }));

    await waitFor(() => expect(localStorage.getItem(PARTY_FIGURE_STORAGE_KEY)).toContain(
      '"scale": 0.9'
    ));
    first.unmount();

    render(<App />);
    const scale = screen.getByLabelText("当前立绘参数").querySelector<HTMLInputElement>(
      'input[type="number"]'
    );
    expect(scale?.value).toBe("0.9");
  });

  it("copies the active export and clears feedback timers on unmount", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "导出参数" }));
    const timersBeforeCopy = vi.getTimerCount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制到剪贴板" }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(timersBeforeCopy + 1);
    unmount();
    expect(vi.getTimerCount()).toBe(timersBeforeCopy);
  });
});
