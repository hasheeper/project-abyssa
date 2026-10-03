import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { MemoryPanel } from "./MemoryPanel";
import type { MemoryEntry, MemoryJournalData } from "./memory-types";
import { useMemoryJournal, type MemoryJournalController } from "./useMemoryJournal";

const entry: MemoryEntry = {
  id: "record", title: "一段旧事", day: 1, phase: "清晨", sequence: 1,
  preview: "已经读过的概述", actors: [], blocks: [{ text: "已经读过的原文" }],
};
const narrative: NonNullable<MemoryEntry["narrative"]> = {
  id: "event", title: entry.title, sequence: 1, startedAt: null, lastRecordedAt: null, participants: [],
  acts: [{ id: "act-text", title: "窗边的手记", coverage: "complete", replay: "text", startedAt: null, slices: [] }],
};
let journal: MemoryJournalController;
function Harness({ record }: { record: MemoryEntry }) {
  const data: MemoryJournalData = { status: "ready", entries: [record] };
  journal = useMemoryJournal("reader-controls", data, 1);
  return <MemoryPanel journal={journal} data={data} onBack={() => {}}/>;
}
const wrapper = ({ children }: { children: React.ReactNode }) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider>;
afterEach(cleanup);

it("offers only transcript expansion for a text-only record without redundant labels", () => {
  render(<Harness record={entry}/>, { wrapper });
  act(() => journal.open(entry.id));
  const reader = screen.getByRole("article", { name: entry.title });
  expect(reader.querySelector(".memory-reader__end")).not.toBeInTheDocument();
  expect(within(reader).queryByText("文字记录")).not.toBeInTheDocument();
  expect(within(reader).getByRole("group", { name: "记录阅读操作" }).querySelector(".memory-reader__act-actions")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /回想场景/ })).not.toBeInTheDocument();
  fireEvent.click(within(reader).getByRole("button", { name: "展开原文" }));
  expect(within(reader).getByText("已经读过的原文")).toBeVisible();
  expect(reader.querySelector(".memory-reader__end")).toBeVisible();
  fireEvent.click(within(reader).getByRole("button", { name: "收起原文" }));
  expect(reader.querySelector(".memory-reader__end")).not.toBeInTheDocument();
});

it("renders the only act as information rather than a disabled dropdown", () => {
  render(<Harness record={{ ...entry, narrative }}/>, { wrapper });
  act(() => journal.open(entry.id));
  expect(screen.getByLabelText("第 1 幕：窗边的手记").tagName).toBe("SPAN");
  expect(screen.queryByRole("button", { name: /选择回想的幕/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "选择回想的幕" })).not.toBeInTheDocument();
});

it("keeps act selection and its replay availability together in the reader", () => {
  const record: MemoryEntry = { ...entry, narrative: { ...narrative, acts: [
    { ...narrative.acts[0], id: "act-scene", title: "餐桌上的早晨", replay: "scene" },
    narrative.acts[0],
  ] } };
  render(<Harness record={record}/>, { wrapper });
  act(() => journal.open(entry.id));
  const reader = screen.getByRole("article", { name: entry.title });
  const actions = within(reader).getByRole("group", { name: "记录阅读操作" });
  expect(within(actions).getByRole("button", { name: "回想场景" })).toBeInTheDocument();
  expect(within(actions).getByRole("button", { name: "展开原文" })).toBeInTheDocument();
  expect(within(actions).getByRole("button", { name: /选择回想的幕/ })).toBeInTheDocument();
  const actActions = actions.querySelector(".memory-reader__act-actions")!;
  expect(actActions).toContainElement(within(actions).getByRole("button", { name: "回想场景" }));
  expect(actActions).not.toContainElement(within(actions).getByRole("button", { name: "展开原文" }));
  expect(actions.querySelector('[data-action="replay"]')).toHaveAttribute("aria-hidden", "true");
  expect(actions.querySelector('[data-action="transcript"]')).toHaveAttribute("aria-hidden", "true");
  expect(actActions.querySelectorAll(".memory-reader__act-frame")).toHaveLength(1);
  expect(actActions.querySelector(".memory-reader__act-frame path")).toHaveAttribute("fill", "none");
  expect(actActions.querySelector(".abyssa-shape-button")).not.toBeInTheDocument();
  const transcriptButton = within(actions).getByRole("button", { name: "展开原文" });
  expect(transcriptButton).toHaveClass("abyssa-shape-button", "scene-feedback__action");
  expect(transcriptButton).toHaveAttribute("data-shape", "chamfer");
  expect(transcriptButton.querySelector("pattern")).not.toBeInTheDocument();
  fireEvent.click(within(reader).getByRole("button", { name: /选择回想的幕/ }));
  fireEvent.click(screen.getByRole("button", { name: /02.*窗边的手记/ }));
  expect(journal.selectedAct?.id).toBe("act-text");
  expect(within(reader).getByRole("button", { name: "展开原文" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /回想场景/ })).not.toBeInTheDocument();
});

it("restores focus to the relocated replay entry and preserves expanded text", async () => {
  render(<Harness record={{ ...entry, replay: "scene" }}/>, { wrapper });
  act(() => journal.open(entry.id));
  const reader = screen.getByRole("article", { name: entry.title });
  const replay = within(reader).getByRole("button", { name: "回想场景" });
  fireEvent.click(within(reader).getByRole("button", { name: "展开原文" }));
  fireEvent.click(replay);
  expect(journal.replayEntry?.id).toBe(entry.id);
  act(() => journal.finishReplay());
  await waitFor(() => expect(replay).toHaveFocus());
  expect(within(reader).getByRole("button", { name: "收起原文" })).toHaveAttribute("aria-expanded", "true");
});
