import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { useMemoryJournal } from "./useMemoryJournal";
import type { MemoryJournalData } from "./memory-types";

type Clock = { get(): number; set(value: number): void };
type Flight = { value: Clock; target: number; stop: ReturnType<typeof vi.fn>; finish(): void };
const flights = vi.hoisted(() => [] as Flight[]);
vi.mock("motion/react", async original => ({
  ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: Clock, target: number) => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const flight = { value, target, stop: vi.fn(), finish: () => { value.set(target); resolve(); } };
    flights.push(flight); return Object.assign(promise, { stop: flight.stop });
  }),
}));
const data: MemoryJournalData = { status: "ready", entries: [
  { id: "a", day: 2, phase: "夜晚", sequence: 2, title: "甲", preview: "甲", actors: [], blocks: [{ text: "甲的原文" }] },
  { id: "b", day: 1, phase: "清晨", sequence: 1, title: "乙", preview: "乙", actors: [], blocks: [{ text: "乙的原文" }] },
] };
afterEach(() => { cleanup(); flights.length = 0; vi.restoreAllMocks(); vi.clearAllMocks(); });
const finish = async (flight: Flight) => act(async () => flight.finish());

it("reverses an opening on Escape; stale completion cannot reopen it", async () => {
  const { result } = renderHook(() => useMemoryJournal("save:1", data, 9));
  act(() => result.current.open("a")); const obsolete = flights.at(-1)!;
  expect(result.current.changeKind).toBe("layout");
  act(() => { expect(result.current.showCatalogue()).toBe(true); });
  const returning = flights.at(-1)!;
  await finish(obsolete);
  expect(result.current.mode).toBe("catalogue");
  await finish(returning); await finish(flights.at(-1)!);
  expect(result.current.changing).toBe(false);
  expect(result.current.mode).toBe("catalogue");
});

it("keeps catalogue transitions separate from a change of reader, and settles on panel unmount", async () => {
  const { result } = renderHook(() => useMemoryJournal("save:1", data, 9));
  act(() => result.current.open("a")); await finish(flights.at(-1)!); await finish(flights.at(-1)!);
  act(() => result.current.open("b"));
  expect(result.current.changeKind).toBe("reader");
  const obsolete = flights.at(-1)!;
  act(() => result.current.settle());
  expect(result.current.selectedId).toBe("b");
  expect(result.current.changing).toBe(false);
  await finish(obsolete);
  expect(result.current.selectedId).toBe("b");
});

it("finishes at the requested view when hidden and discards the previous save's pending selection", async () => {
  const { result, rerender } = renderHook(({ scope }) => useMemoryJournal(scope, data, 9), { initialProps: { scope: "save:1" } });
  act(() => result.current.open("a")); const obsolete = flights.at(-1)!;
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.mode).toBe("reading"); expect(result.current.changing).toBe(false);
  rerender({ scope: "save:2" });
  await finish(obsolete);
  expect(result.current.mode).toBe("catalogue"); expect(result.current.selectedId).toBeNull();
});

it("changes immediately with reduced motion and leaves no transition pending", () => {
  const { result } = renderHook(() => useMemoryJournal("save:1", data, 9), {
    wrapper: ({ children }) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider>,
  });
  act(() => result.current.open("a"));
  expect(result.current.mode).toBe("reading"); expect(result.current.changing).toBe(false);
  act(() => result.current.showCatalogue());
  expect(result.current.mode).toBe("catalogue"); expect(result.current.opacity.get()).toBe(1);
  expect(flights).toHaveLength(0);
});

it("preserves old content during the reading return, then applies the latest range", async () => {
  const { result } = renderHook(() => useMemoryJournal("save:1", data, 9));
  act(() => result.current.open("a")); await finish(flights.at(-1)!); await finish(flights.at(-1)!);
  act(() => result.current.setRange({ kind: "days", from: 1, to: 1 }));
  expect(result.current.mode).toBe("catalogue");
  expect(result.current.selected?.id).toBe("a");
  expect(result.current.visible).toHaveLength(2);
  act(() => result.current.setRange({ kind: "days", from: 2, to: 2 }));
  for (let step = 0; step < 5; step++) await finish(flights.at(-1)!);
  expect(result.current.visible.map(entry => entry.id)).toEqual(["a"]);
  expect(result.current.selected).toBeNull();
  expect(result.current.changing).toBe(false);
});

it("revalidates a selected entry when the same save receives a newer revision", async () => {
  const { result, rerender } = renderHook(({ next }) => useMemoryJournal("save:1", next, 9), { initialProps: { next: data } });
  act(() => result.current.open("a")); const obsolete = flights.at(-1)!;
  rerender({ next: { status: "ready", entries: [] } });
  expect(result.current.mode).toBe("catalogue"); expect(result.current.selectedId).toBeNull();
  await finish(obsolete);
  expect(result.current.mode).toBe("catalogue"); expect(result.current.selected).toBeNull();
});

it("returns from a frozen replay before leaving the reader, and clears it on save changes or retraction", () => {
  const replayData: MemoryJournalData = { status: "ready", entries: [{ ...data.entries[0], replay: "scene" }] };
  const { result, rerender } = renderHook(({ scope, next }) => useMemoryJournal(scope, next, 9), {
    initialProps: { scope: "save:1", next: replayData }, wrapper: ({ children }) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider>,
  });
  act(() => { result.current.open("a"); });
  act(() => { result.current.startReplay(); });
  const snapshot = result.current.replayEntry;
  expect(snapshot?.id).toBe("a");
  rerender({ scope: "save:1", next: { status: "ready", entries: [{ ...replayData.entries[0], blocks: [...replayData.entries[0].blocks, { text: "新读到的段落" }] }] } });
  expect(result.current.replayEntry).toBe(snapshot);
  act(() => { expect(result.current.showCatalogue()).toBe(true); });
  expect(result.current.replayEntry).toBeNull(); expect(result.current.mode).toBe("reading");
  expect(result.current.focusIntent.current).toBe("replay");
  act(() => result.current.startReplay());
  rerender({ scope: "save:1", next: { status: "ready", entries: [{ ...replayData.entries[0], blocks: [{ text: "来源已改变" }] }] } });
  expect(result.current.replayEntry).toBeNull();
  act(() => result.current.startReplay());
  rerender({ scope: "save:2", next: replayData });
  expect(result.current.replayEntry).toBeNull(); expect(result.current.mode).toBe("catalogue");
});
