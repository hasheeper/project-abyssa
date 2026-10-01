import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { MemoryReplay } from "./MemoryReplay";
import { memoryReplayPages } from "./memory-replay";
import type { MemoryEntry } from "./memory-types";

const entry: MemoryEntry = { id: "read-only", title: "已读片段", day: 1, phase: "清晨", sequence: 1, preview: "已经读过", actors: ["诺玛"], replay: "scene",
  blocks: [
    { text: "已经读过", speaker: "诺玛", stage: { background: { kind: "asset", url: "" }, actorId: "norma", emotion: "serious" } },
    { text: "留下", kind: "choice", stage: { background: { kind: "asset", url: "" } } },
    { text: "当时选择之后的原文", stage: { background: { kind: "asset", url: "" } } },
  ].map((b, i) => ({ ...b, source: { kind: "authored", saveId: "save", epoch: "epoch", revision: i + 1, factId: `fact:${i}`, sceneId: i < 2 ? "first" : "second", lineId: `line:${i}` } })) as MemoryEntry["blocks"] };
afterEach(cleanup);

it("projects frozen speakers, expressions, choices and scene boundaries without future lookup", () => {
  const pages = memoryReplayPages(entry);
  expect(pages).toHaveLength(3);
  expect(pages[0].messages).toEqual([{ id: pages[0].id, kind: "say", actorId: "norma", text: "已经读过", emotion: "serious", expression: undefined, offstage: false }]);
  expect(pages[1].messages.at(-1)).toMatchObject({ kind: "narration", text: "当时的选择：留下" });
  expect(pages[2].messages).toHaveLength(1);
  expect(memoryReplayPages({ ...entry, replay: undefined })).toEqual([]);
  expect(memoryReplayPages({ ...entry, blocks: [{ text: "没有来源的文本" }] })).toEqual([]);
});

it("keeps changing initial cast and portraits local, carries direction cues and freezes each message prefix", () => {
  const source = entry.blocks[0].source!;
  const background = { kind: "asset" as const, url: "frozen-room" };
  const memory: MemoryEntry = { ...entry, blocks: [
    { text: "第一句", speaker: "当时的诺玛", source, stage: { background, actorId: "norma", initialSlots: { left: "marietta" }, portraits: { marietta: "first-portrait" } } },
    { text: "", source: { ...source, lineId: "direction" }, frame: { id: "direction", kind: "direction", waitMs: 80 },
      stage: { background, actors: [{ characterId: "eustice", emotion: "serious" }], initialSlots: { left: "kororo" } } },
    { text: "第二句", speaker: "后来的名字", source: { ...source, lineId: "next" },
      stage: { background, actorId: "norma", expression: "b", offstageActorId: "norma", initialSlots: { left: "kororo" }, portraits: { norma: "next-portrait" } } },
    { text: "另一段", source: { ...source, sceneId: "second" }, stage: { background } },
  ] };
  const before = JSON.stringify(memory), pages = memoryReplayPages(memory);
  expect(pages).toHaveLength(3);
  expect(pages[0].actors.map(a => a.id)).toEqual(expect.arrayContaining(["norma", "eustice", "marietta"]));
  expect(pages[0].actors.some(a => a.id === "kororo")).toBe(false);
  expect(pages[0].actors.find(a => a.id === "marietta")?.portrait).toBe("first-portrait");
  expect(pages[1].actors.some(a => a.id === "marietta")).toBe(false);
  expect(pages[1].actors.find(a => a.id === "norma")).toMatchObject({ name: "当时的诺玛", portrait: "next-portrait" });
  expect(pages[1].actors.some(a => a.id === "kororo")).toBe(true);
  expect(pages[1].messages[1]).toMatchObject({ kind: "stage", actorId: "eustice", emotion: "serious" });
  expect(pages[1].messages.at(-1)).toMatchObject({ kind: "say", expression: "b", offstage: true });
  expect(pages[0].messages).toHaveLength(1);
  expect(pages[2].messages).toHaveLength(1);
  expect(pages[0].initialSlots).toEqual({ left: "marietta" });
  expect(pages[1].initialSlots).toEqual({ left: "kororo" });
  expect(JSON.stringify(memory)).toBe(before);
});

it("plays the saved branch to the end, with reduced motion, without offering a new choice", async () => {
  const close = vi.fn(), exited = vi.fn(), before = JSON.stringify(entry);
  render(<UiMotionProvider preference="reduced"><MemoryReplay entry={entry} leaving={false} onClose={close} onExited={exited}/></UiMotionProvider>);
  await waitFor(() => expect(screen.getByRole("button", { name: "下一句" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "下一句" }));
  expect(screen.getByText("当时的选择：留下")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "留下" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "下一句" }));
  expect(screen.getByText("当时选择之后的原文")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "回到手记" }));
  expect(close).toHaveBeenCalledOnce();
  expect(JSON.stringify(entry)).toBe(before);
});
