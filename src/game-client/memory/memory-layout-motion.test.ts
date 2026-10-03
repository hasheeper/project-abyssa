import { afterEach, expect, it, vi } from "vitest";
import { motionTokens } from "../../shared/ui/motion/presets";
import { bindMemoryLayout, captureMemoryLayout } from "./memory-layout-motion";

function memoryLayout() {
  const root = document.createElement("main");
  root.className = "memory-panel";
  root.innerHTML = `<div class="memory-catalogue"><div class="memory-catalogue__track">
    <div data-memory-id="first"><button class="memory-entry">
      <span class="memory-entry__node"></span>
      <span class="memory-entry__when" style="opacity: 1"><span>第 1 天</span><small>清晨</small></span>
      <span class="memory-entry__art"></span>
      <span class="memory-entry__copy" style="opacity: 1"><strong>初到洋馆</strong></span>
    </button></div>
  </div></div>`;
  document.body.append(root);
  Object.defineProperty(root, "offsetWidth", { value: 1000 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const reading = root.dataset.memoryMode === "reading";
    if (this === root) return new DOMRect(0, 0, 1000, 600);
    if (this.matches(".memory-entry__when")) return new DOMRect(38, reading ? 23 : 20, reading ? 64 : 110, reading ? 42 : 58);
    if (this.matches(".memory-entry__copy")) return new DOMRect(reading ? 170 : 250, 24, 228, 27);
    if (this.matches(".memory-entry__art")) return new DOMRect(114, 22, reading ? 44 : 88, reading ? 44 : 88);
    if (this.matches(".memory-entry__node")) return new DOMRect(12, reading ? 37.5 : 24, 13, 13);
    return new DOMRect(0, 0, reading ? 420 : 1000, reading ? 88 : 124);
  });
  const when = root.querySelector<HTMLElement>(".memory-entry__when")!;
  const day = when.querySelector<HTMLElement>("span")!;
  const phase = when.querySelector<HTMLElement>("small")!;
  const setMode = (mode: "catalogue" | "reading") => {
    root.dataset.memoryMode = mode;
    const reading = mode === "reading";
    for (const element of [when, day]) {
      element.style.font = reading ? "400 15px/20px serif" : "400 22px/30px serif";
      element.style.color = reading ? "#87988c" : "#9aa798";
    }
    phase.style.font = reading ? "400 13px/18px serif" : "400 15px/21px serif";
  };
  return { root, when, day, phase, setMode };
}

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

it.each([true, false])("crossfades frozen date typography without a size jump (opening: %s)", opening => {
  const { root, when, day, phase, setMode } = memoryLayout();
  setMode(opening ? "catalogue" : "reading");
  const oldFont = getComputedStyle(day).fontSize;
  const oldPhaseFont = getComputedStyle(phase).fontSize;
  const before = captureMemoryLayout(root);
  setMode(opening ? "reading" : "catalogue");
  const targetFont = getComputedStyle(day).fontSize;
  const animation = bindMemoryLayout(root, before, opening);
  const outgoing = root.querySelector<HTMLElement>(".memory-entry__when--outgoing")!;
  const oldDay = outgoing.querySelector<HTMLElement>("span")!;
  expect(outgoing.getAttribute("aria-hidden")).toBe("true");
  expect(outgoing.style.pointerEvents).toBe("none");
  animation.paint(0);
  expect(when.style.opacity).toBe("0");
  expect(outgoing.style.opacity).toBe("1");
  expect(getComputedStyle(oldDay).fontSize).toBe(oldFont);
  expect(getComputedStyle(outgoing.querySelector("small")!).fontSize).toBe(oldPhaseFont);
  const timing = opening ? motionTokens.memoryJournal.opening : motionTokens.memoryJournal.closing;
  const start = opening ? 0 : motionTokens.memoryJournal.closing.layoutStartMs;
  const duration = opening ? motionTokens.memoryJournal.openMs : motionTokens.memoryJournal.closeMs;
  animation.paint((start + timing.layoutMs / 2) / duration);
  expect(Number(when.style.opacity)).toBeGreaterThan(0);
  expect(Number(when.style.opacity)).toBeLessThan(1);
  expect(Number(when.style.opacity) + Number(outgoing.style.opacity)).toBeCloseTo(1);
  expect(getComputedStyle(oldDay).fontSize).toBe(oldFont);
  expect(getComputedStyle(day).fontSize).toBe(targetFont);
  animation.paint(1);
  expect(when.style.opacity).toBe("1");
  expect(outgoing.style.opacity).toBe("0");
  animation.clear();
  expect(root.querySelector(".memory-entry__when--outgoing")).toBeNull();
  expect(when.style.opacity).toBe("");
  expect(when.style.translate).toBe("");
});

it("preserves the visible date layer when reversing an interrupted transition", () => {
  const { root, setMode } = memoryLayout();
  setMode("catalogue");
  const before = captureMemoryLayout(root);
  setMode("reading");
  const opening = bindMemoryLayout(root, before, true);
  opening.paint(.03);
  const interrupted = captureMemoryLayout(root);
  const snapshot = interrupted.rows.get("first")!;
  expect(snapshot.whenAlpha).toBeGreaterThan(.9);
  expect(snapshot.when?.querySelector<HTMLElement>("span")?.style.fontSize).toBe("22px");
  opening.clear();
  setMode("catalogue");
  const closing = bindMemoryLayout(root, interrupted, false);
  closing.paint(0);
  expect(root.querySelectorAll(".memory-entry__when--outgoing")).toHaveLength(1);
  expect(Number(root.querySelector<HTMLElement>(".memory-entry__when--outgoing")!.style.opacity)).toBeCloseTo(snapshot.whenAlpha);
  closing.paint(1);
  closing.clear();
  expect(root.querySelectorAll(".memory-entry__when--outgoing, .memory-entry__copy--outgoing")).toHaveLength(0);
});
