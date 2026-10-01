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
