import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { MemoryFooter } from "./MemoryFooter";
import { useMemoryJournal, type MemoryJournalController } from "./useMemoryJournal";
import type { MemoryJournalData } from "./memory-types";

const data: MemoryJournalData = { status: "ready", entries: [9, 4, null].map((day, i) => ({
  id: String(i), day, phase: "", sequence: i, title: `记录${i}`, preview: "预览", actors: [], blocks: [{ text: "原文" }],
})) };
let journal: MemoryJournalController;
const onBack = vi.fn();
function Harness() {
  journal = useMemoryJournal("footer-preview", data, 9);
  return <MemoryFooter journal={journal} available onBack={onBack}/>;
}
const wrapper = ({ children }: { children: React.ReactNode }) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider>;
afterEach(() => { cleanup(); onBack.mockClear(); });

it("shows the filtered count and lets the undated shortcut toggle back to all memories", () => {
  render(<Harness/>, { wrapper });
  expect(screen.getByText("3 条记录")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /回想场景/ })).not.toBeInTheDocument();
  const undated = screen.getByRole("button", { name: "时间未记录 · 1" });
  fireEvent.click(undated);
  expect(undated).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("1 条记录")).toBeInTheDocument();
  fireEvent.click(undated);
  expect(undated).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("3 条记录")).toBeInTheDocument();
});

it("navigates records and returns through the catalogue while scene recollection stays unavailable", () => {
  render(<Harness/>, { wrapper });
  act(() => journal.open("0"));
  expect(screen.getByLabelText("第 1 条，共 3 条记录")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "前一条" })).toBeDisabled();
  const replay = screen.getByRole("button", { name: "回想场景（仅文字记录）" });
  expect(replay).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(replay);
  expect(journal.selectedId).toBe("0");
  fireEvent.click(screen.getByRole("button", { name: "后一条" }));
  expect(journal.selectedId).toBe("1");
  expect(screen.getByLabelText("第 2 条，共 3 条记录")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "前一条" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "返回目录" }));
  expect(journal.mode).toBe("catalogue");
  expect(onBack).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^返回$/ }));
  expect(onBack).toHaveBeenCalledOnce();
});
