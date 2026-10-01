import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createMenuBackendPreviewRuntime } from "../../game-runtime/menu-preview";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { useMemoryJournal, type MemoryJournalController } from "./useMemoryJournal";
import { MemoryFooter } from "./MemoryFooter";
import { MemoryReader } from "./MemoryReader";
import { MemoryReplay } from "./MemoryReplay";
import { memoryReplayPages } from "./memory-replay";
import { orderedMemories, type MemoryJournalData } from "./memory-types";

afterEach(cleanup);
it("selects a recorded shop act for transcript and replay, and keeps replay read-only", async () => {
  const f = await createMenuBackendPreviewRuntime("shop"), raw = f.database.records.get(f.locator.saveId)!;
  const data = f.runtime.queries.memoryJournal(raw);
  if (data.status !== "ready") throw Error("Journal unavailable");
  const entry = data.entries.find(e => e.title === "初访杂货铺")!;
  let journal: MemoryJournalController;
  function Harness({ next }: { next: MemoryJournalData }) {
    journal = useMemoryJournal("shop-acts", next, 1);
    return <><MemoryReader journal={journal}/><MemoryFooter journal={journal} available onBack={() => {}}/>
      {journal.replayEntry && <MemoryReplay entry={journal.replayEntry} actId={journal.replayActId}
        leaving={journal.replayLeaving} onClose={journal.stopReplay} onExited={journal.finishReplay}/>}</>;
  }
  const wrapper = ({ children }: { children: React.ReactNode }) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider>;
  const { rerender } = render(<Harness next={data}/>, { wrapper });
  act(() => journal.open(entry.id));
  expect(screen.getByRole("img", { name: "缇比" }).querySelector("img"))
    .toHaveAttribute("src", expect.stringContaining("/avatars/tibby.png"));
  fireEvent.click(screen.getByRole("button", { name: "展开原文" }));
  fireEvent.click(screen.getByRole("button", { name: /选择回想的幕/ }));
  expect(screen.getByRole("group", { name: "选择回想的幕" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /03.*结界钉的去留/ }));
  expect(screen.getByText("第 3 幕 · 结界钉的去留")).toBeInTheDocument();
  expect(journal!.transcript.some(b => b.kind === "choice")).toBe(true);
  expect(journal!.transcript.some(b => b.kind === "receipt")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "回想场景" }));
  expect(journal!.replayActId).toBe(entry.narrative!.acts[2].id);
  const snapshot = journal!.replayEntry!;
  const pages = memoryReplayPages(snapshot, journal!.replayActId);
  expect(pages.length).toBeGreaterThan(0);
  expect(new Set(pages.map(p => p.sceneId))).toEqual(new Set([entry.narrative!.acts[2].id]));
  expect(pages.at(-1)!.messages.some(m => m.kind === "narration" && m.text.includes("出售"))).toBe(true);
  await waitFor(() => expect(screen.getByRole("button", { name: "下一幕" })).toBeEnabled(), { timeout: 5000 });
  expect(screen.getByRole("navigation", { name: "幕切换" })).toHaveTextContent("III/V");
  fireEvent.click(screen.getByRole("button", { name: "下一幕" }));
  await waitFor(() => expect(screen.getByRole("navigation", { name: "幕切换" })).toHaveTextContent("IV/V"), { timeout: 5000 });
  expect(screen.getByRole("main", { name: "初访杂货铺 · 下次出行的补给" })).toBeInTheDocument();
  expect(f.database.records.get(f.locator.saveId)).toBe(raw);
  // A changed/retracted receipt must close the frozen playback.
  const changed = structuredClone(data);
  const modified = changed.entries.find(e => e.id === entry.id)!;
  const selected = modified.narrative!.acts[2];
  modified.narrative = { ...modified.narrative!, acts: modified.narrative!.acts.map(a => a.id === selected.id
    ? { ...a, slices: a.slices.map(s => ({ ...s, steps: s.steps.filter(step => step.kind !== "receipt") })) } : a) };
  rerender(<Harness next={changed}/>);
  expect(journal!.replayEntry).toBeNull();
}, 60000);

it("finds a continuing event on every day with recorded content", () => {
  const entry = { id: "event", title: "跨日事件", day: 1, phase: "", sequence: 0, actors: [], preview: "", blocks: [], recordedDays: [1, 3] };
  expect(orderedMemories([entry], { kind: "days", from: 3, to: 3 }, "recent")).toEqual([entry]);
  expect(orderedMemories([entry], { kind: "days", from: 2, to: 2 }, "recent")).toEqual([]);
});
