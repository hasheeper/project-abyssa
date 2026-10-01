import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { MemoryPanel } from "./MemoryPanel";
import { useMemoryJournal, type MemoryJournalController } from "./useMemoryJournal";
import type { MemoryJournalData } from "./memory-types";
import { moveMemoryRange, normalizeMemoryRange } from "./memory-range";

const data: MemoryJournalData = { status: "ready", entries: [9, 4, null].map((day, i) => ({
  id: String(i), day, phase: "", sequence: i, title: `记录${i}`, preview: "预览", actors: [], blocks: [{ text: "已读正文" }],
})) };
let journal: MemoryJournalController;
function Harness({ now = 9, scope = "preview" }: { now?: number; scope?: string }) {
  journal = useMemoryJournal(scope, data, now);
  return <MemoryPanel journal={journal} data={data} onBack={() => {}}/>;
}
const wrapper = ({ children }: { children: React.ReactNode }) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider>;
beforeEach(() => {
  vi.stubGlobal("PointerEvent", class extends MouseEvent { pointerId: number; constructor(type: string, options: PointerEventInit) { super(type, options); this.pointerId = options.pointerId ?? 1; } });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, x: 0, top: 0, y: 0, width: 900, height: 40, right: 900, bottom: 40, toJSON() {} });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture; delete (HTMLElement.prototype as Partial<HTMLElement>).hasPointerCapture; });

it("updates a drag preview without filtering, then commits only on release", () => {
  render(<Harness/>, { wrapper });
  const track = screen.getByRole("group", { name: "时间刻度" });
  fireEvent.pointerDown(screen.getByRole("slider", { name: "起始日期" }), { pointerId: 1, clientX: 0, button: 0 });
  fireEvent.pointerMove(track, { pointerId: 1, clientX: 300 });
  expect(screen.getByRole("button", { name: "调整日期：第 4—9 天" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^阅读：/ })).toHaveLength(3);
  fireEvent.pointerUp(track, { pointerId: 1, clientX: 300 });
  expect(screen.getAllByRole("button", { name: /^阅读：/ })).toHaveLength(2);
  expect(journal.range).toEqual({ kind: "days", from: 4, to: 9 });
});

it("cancels pointer and keyboard drafts before the menu consumes Escape", () => {
  render(<Harness/>, { wrapper });
  const start = screen.getByRole("slider", { name: "起始日期" });
  fireEvent.keyDown(start, { key: "ArrowRight" });
  expect(screen.getByRole("button", { name: "调整日期：第 2—9 天" })).toBeInTheDocument();
  act(() => { expect(journal.showCatalogue()).toBe(true); });
  fireEvent.keyUp(start, { key: "ArrowRight" });
  expect(journal.range).toEqual({ kind: "all" });
  fireEvent.pointerDown(start, { pointerId: 2, clientX: 0, button: 0 });
  fireEvent.pointerMove(screen.getByRole("group", { name: "时间刻度" }), { pointerId: 2, clientX: 500 });
  fireEvent.pointerCancel(screen.getByRole("group", { name: "时间刻度" }), { pointerId: 2 });
  expect(screen.getByRole("button", { name: "调整日期：全部经历" })).toBeInTheDocument();
});

it("keeps empty dates real, supports exact ranges, and separates undated memories", () => {
  render(<Harness now={12}/>, { wrapper });
  expect(screen.getByRole("button", { name: "回到现在，第 12 天" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "调整日期：全部经历" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "起始天数" }), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: /^确定$/ }));
  expect(screen.queryAllByRole("button", { name: /^阅读：/ })).toHaveLength(0);
  expect(screen.getByText("这段时间没有已收录的记忆。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "时间未记录 · 1" }));
  expect(screen.getByRole("button", { name: "阅读：记录2" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^全部$/ }));
  expect(screen.getAllByRole("button", { name: /^阅读：/ })).toHaveLength(3);
});

it("edits dates inline, rejects invalid ranges, and cancels without leaving the reader", () => {
  render(<Harness/>, { wrapper });
  act(() => journal.open("0"));
  const readout = screen.getByRole("button", { name: "调整日期：全部经历" });
  fireEvent.click(readout);
  const input = screen.getByRole("spinbutton", { name: "起始天数" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("form", { name: "精确调整日期" })).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "0" } });
  expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "8" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "结束天数" }), { target: { value: "3" } });
  expect(screen.getByText("起始日期不能晚于结束日期")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("form", { name: "精确调整日期" })).not.toBeInTheDocument();
  expect(readout).toHaveFocus();
  expect(journal.mode).toBe("reading");
  expect(journal.range).toEqual({ kind: "all" });
});

it("keeps selected dates through clock advance and resets drafts when changing save", () => {
  const { rerender } = render(<Harness/>, { wrapper });
  fireEvent.click(screen.getByRole("button", { name: "查看第 5 天" }));
  rerender(<Harness now={10}/>);
  expect(journal.range).toEqual({ kind: "days", from: 5, to: 5 });
  fireEvent.click(screen.getByRole("button", { name: "调整日期：第 5 天" }));
  rerender(<Harness now={10} scope="another-save"/>);
  expect(journal.range).toEqual({ kind: "all" });
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
});

it("clamps movement without changing span and normalizes full or crossed ranges", () => {
  expect(moveMemoryRange({ from: 20, to: 30 }, -100, 365)).toEqual({ from: 1, to: 11 });
  expect(moveMemoryRange({ from: 20, to: 30 }, 999, 365)).toEqual({ from: 355, to: 365 });
  expect(normalizeMemoryRange({ kind: "days", from: 500, to: -2 }, 365)).toEqual({ kind: "all" });
  expect(normalizeMemoryRange({ kind: "days", from: 9, to: 3 }, 365)).toEqual({ kind: "days", from: 3, to: 9 });
});
