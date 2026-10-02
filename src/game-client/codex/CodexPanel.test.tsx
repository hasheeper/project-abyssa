import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { motionValue } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { codexSamples } from "./codex-preview";
import { CodexPanel, codexArtLayout } from "./CodexPanel";
import { createCodexBackendPreviewRuntime } from "../../game-runtime/codex-preview";
import { codexEntries } from "./codex-entries";

afterEach(cleanup);
const sceneMotion = { clock: motionValue(1), exiting: false, skip: true };

describe("CodexPanel catalogue", () => {
  it("uses backend stages without leaking locked artwork, action text or drops", async () => {
    const source = await createCodexBackendPreviewRuntime("seen");
    const data = source.runtime.queries.codex(source.database.records.get(source.locator.saveId)!);
    if (data.status !== "ready") throw Error(data.message);
    const entries = codexEntries(data.entries);
    const { unmount } = render(<CodexPanel entries={entries} onBack={() => {}} sceneMotion={sceneMotion}/>);
    expect(screen.getByRole("heading", {level: 2})).toHaveTextContent("浊泥史莱姆");
    expect(screen.getByRole("navigation", {name: "生物条目"}).querySelectorAll("img")).toHaveLength(1);
    expect(screen.queryByText("行动方式")).not.toBeInTheDocument();
    expect(screen.queryByText("凝胶")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", {name: "可能掉落"})).getAllByText("击败后记录")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", {name: "未收录 No.002"}));
    expect(screen.getByRole("heading", {level: 2})).toHaveTextContent("未收录");
    expect(screen.queryByRole("img", {name: /观察草图/})).not.toBeInTheDocument();
    unmount();
    const complete = await createCodexBackendPreviewRuntime("defeated");
    const completed = complete.runtime.queries.codex(complete.database.records.get(complete.locator.saveId)!);
    if (completed.status !== "ready") throw Error(completed.message);
    render(<CodexPanel entries={codexEntries(completed.entries)} onBack={() => {}} sceneMotion={sceneMotion}/>);
    expect(screen.getByText("行动方式")).toBeInTheDocument();
    expect(document.querySelector(".codex-panel")).toHaveAttribute("data-codex-stage", "defeated");
    expect(within(screen.getByRole("region", {name: "可能掉落"})).getAllByRole("listitem")).toHaveLength(4);
    expect(document.querySelectorAll(".codex-drops__image i")).toHaveLength(2);
  });
  it("selects every prepared asset with matching art, title and four drop slots", () => {
    render(<CodexPanel entries={codexSamples} onBack={() => {}} sceneMotion={sceneMotion}/>);
    const index = screen.getByRole("navigation", { name: "生物条目" });
    expect(within(index).getAllByRole("button")).toHaveLength(codexSamples.length);
    for (const entry of codexSamples) {
      const button = within(index).getByRole("button", { name: entry.name });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-current", "true");
      expect(index.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(entry.name);
      expect(screen.getByRole("img", { name: `${entry.name}的观察草图` })).toHaveAttribute("src", entry.image);
      expect(entry.image).toBeTruthy();
      expect(entry.thumbnail).toBeTruthy();
      const drops = screen.getByRole("region", { name: "可能掉落" });
      expect(within(drops).getAllByRole("listitem")).toHaveLength(4);
      for (const drop of entry.drops) expect(within(drops).getByText(drop.name)).toBeInTheDocument();
    }
  });

  it("keeps keyboard selection and focus together, including list boundaries", () => {
    const onBack = vi.fn();
    render(<CodexPanel entries={codexSamples} onBack={onBack} sceneMotion={sceneMotion}/>);
    const buttons = within(screen.getByRole("navigation", { name: "生物条目" })).getAllByRole("button");
    const last = codexSamples.length - 1;
    for (const [index, key, target] of [[0, "ArrowUp", 0], [0, "ArrowDown", 1], [1, "End", last], [last, "ArrowDown", last], [last, "ArrowUp", last - 1], [last - 1, "Home", 0]] as const) {
      fireEvent.keyDown(buttons[index], { key });
      expect(buttons[target]).toHaveFocus();
      expect(buttons[target]).toHaveAttribute("aria-current", "true");
      expect(buttons.filter(button => button.tabIndex === 0)).toEqual([buttons[target]]);
    }
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("enlarges linework proportionally and keeps the visual centre stable", () => {
    for (const entry of codexSamples) {
      const { drawing } = entry;
      const layout = codexArtLayout(drawing);
      expect(layout.width).toBeLessThanOrEqual(550 * drawing.displayScale);
      expect(layout.height).toBeLessThanOrEqual(400.000001 * drawing.displayScale);
      expect(layout.width / layout.height).toBeCloseTo(drawing.width / drawing.height);
      expect(layout.offsetX - layout.width / 2).toBeGreaterThanOrEqual(-282.000001 * drawing.displayScale);
      expect(layout.offsetX + layout.width / 2).toBeLessThanOrEqual(282.000001 * drawing.displayScale);
      expect(layout.offsetX + (drawing.centerX - .5) * layout.width).toBeCloseTo(0);
    }
  });
});
