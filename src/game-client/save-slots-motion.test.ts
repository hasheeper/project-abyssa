import { describe, expect, it } from "vitest";
import { bindSaveSlotMotion, slotOrder, slotPageVisibility, slotSceneProgress, slotSelectionTracks, slotTiming } from "./save-slots-motion";

function fixture() {
  const root = document.createElement("main");
  root.innerHTML = '<div class="abyssa-system-toolbar"><span class="abyssa-system-toolbar__label"></span><nav class="abyssa-system-tabs"><button>1</button><button>2</button><button>3</button></nav><div class="abyssa-system-toolbar__actions"><button>import</button></div></div><footer class="abyssa-system-panel__footer"><div class="save-slots__footer-actions"><span class="save-slots__feedback"></span><button>back</button><button>save</button></div></footer>';
  for (let row = 0; row < 2; row++) {
    const rail = document.createElement("div"); rail.className = "save-slots__rail"; root.append(rail);
    for (let column = 0; column < 5; column++) for (const name of ["save-slots__body", "save-slots__anchor"]) {
      const element = document.createElement("span"); element.className = name; rail.append(element);
    }
  }
  return root;
}
describe("save-slot choreography", () => {
  it("unfolds rails before alternating upper/lower nodes and leaves chrome until last", () => {
    expect(Array.from({ length: 10 }, (_, i) => slotOrder(i))).toEqual([0, 2, 4, 6, 8, 1, 3, 5, 7, 9]);
    expect(slotSceneProgress(.2, false, "rail")).toBeGreaterThan(.5);
    expect(slotSceneProgress(.2, false, "body")).toBe(0);
    expect(slotSceneProgress(.2, false, "anchor")).toBe(0);
    expect(slotSceneProgress(.6, false, "body", 0)).toBe(1);
    expect(slotSceneProgress(.55, false, "body", 9)).toBe(0);
    expect(slotSceneProgress(.7, false, "chrome")).toBe(0);
    for (const part of ["rail", "body", "anchor", "chrome", "surface"] as const) expect(slotSceneProgress(1, false, part, part === "rail" ? 1 : part === "chrome" ? 4 : 9)).toBe(1);
  });
  it("plays the exact reverse choreography: controls, records, nodes, then rails", () => {
    expect(slotSceneProgress(.3, true, "chrome")).toBe(1);
    expect(slotSceneProgress(.15, true, "body", 0)).toBe(0);
    expect(slotSceneProgress(.3, true, "body", 9)).toBeGreaterThan(0);
    expect(slotSceneProgress(.3, true, "body", 0)).toBe(0);
    expect(slotSceneProgress(.7, true, "body", 0)).toBe(1);
    expect(slotSceneProgress(.7, true, "rail", 1)).toBe(0);
    expect(slotSceneProgress(.9, true, "rail")).toBeGreaterThan(0);
    for (const part of ["rail", "body", "anchor", "chrome", "surface"] as const) {
      for (const clock of [0, .2, .55, .8, 1]) expect(slotSceneProgress(clock, true, part)).toBeCloseTo(1 - slotSceneProgress(1 - clock, false, part));
      expect(slotSceneProgress(1, true, part)).toBe(1);
    }
    expect(slotTiming.exitMs).toBeGreaterThan(1200);
  });
  it("keeps navigation and rails visible throughout paging while only records retire", () => {
    const root = fixture(), paint = bindSaveSlotMotion(root, false, true);
    for (const phase of ["leaving", "entering"] as const) for (const clock of [0, .2, .5, .8, 1]) {
      paint(1, clock, phase);
      for (const rail of root.querySelectorAll<HTMLElement>(".save-slots__rail")) expect(rail.style.getPropertyValue("--slot-rail-scale")).toBe("1");
      for (const item of root.querySelectorAll<HTMLElement>("[data-system-motion-item]")) expect(item.style.getPropertyValue("--system-item-opacity")).toBe("1");
      expect(slotPageVisibility(clock, phase, "chrome", 4)).toBe(1);
      expect(root.style.getPropertyValue("--slot-surface-opacity")).toBe("1");
    }
    expect(slotPageVisibility(.5, "entering", "body", 0)).toBe(1);
    expect(slotPageVisibility(.3, "entering", "body", 9)).toBe(0);
    expect(slotPageVisibility(1, "leaving", "body")).toBe(0);
    expect(slotPageVisibility(.6, "entering", "export", 4)).toBe(0);
    expect(slotPageVisibility(1, "entering", "export", 4)).toBe(1);
  });
  it("captures live visibility and displacement when a scene reverses", () => {
    const root = fixture(); bindSaveSlotMotion(root, false, true)(.52, 1, "ready");
    const body = root.querySelector<HTMLElement>(".save-slots__body")!;
    const before = { opacity: body.style.opacity, translate: body.style.translate };
    bindSaveSlotMotion(root, true, false)(0, 1, "ready");
    expect({ opacity: body.style.opacity, translate: body.style.translate }).toEqual(before);
  });
  it("retains each layer's original basis when data arrives midway through entrance", () => {
    const root = fixture(), starts = new WeakMap<HTMLElement, { start: number; startY: number }>();
    const first = bindSaveSlotMotion(root, false, true, starts);
    first(.15, 1, "ready");
    const rail = root.querySelector<HTMLElement>(".save-slots__rail")!;
    const before = rail.style.getPropertyValue("--slot-rail-scale");
    bindSaveSlotMotion(root, false, false, starts)(.15, 1, "ready");
    expect(rail.style.getPropertyValue("--slot-rail-scale")).toBe(before);
  });
  it("handles CSSOM's one-component zero translate without a ten-pixel jump", () => {
    const root = fixture(); bindSaveSlotMotion(root, false, true)(1, 1, "ready");
    const body = root.querySelector<HTMLElement>(".save-slots__body")!;
    body.style.translate = "0px";
    bindSaveSlotMotion(root, true, false)(0, 1, "ready");
    expect(body.style.translate).toBe("0 0px");
  });
  it("settles every layer for reduced motion and conserves row width when selecting", () => {
    const root = fixture(); bindSaveSlotMotion(root, false, true)(0, 0, "entering", true);
    expect(root.querySelector<HTMLElement>(".save-slots__body")!.style.opacity).toBe("1");
    expect(root.querySelector<HTMLElement>(".abyssa-system-tabs button")!.style.getPropertyValue("--system-item-opacity")).toBe("1");
    const tracks = slotSelectionTracks(2).split(" ").map(Number.parseFloat);
    expect(tracks[2]).toBeGreaterThan(1); expect(tracks[0]).toBeLessThan(1);
    expect(tracks.reduce((a, b) => a + b)).toBeCloseTo(5);
    expect(slotSelectionTracks(null)).toBe("1fr 1fr 1fr 1fr 1fr");
  });
  it("gives each tab and footer action its own scene and mode window, but no page fade", () => {
    const root = fixture(), tabs = Array.from(root.querySelectorAll<HTMLElement>(".abyssa-system-tabs button"));
    const buttons = Array.from(root.querySelectorAll<HTMLElement>(".save-slots__footer-actions button"));
    const values = (elements: HTMLElement[]) => elements.map(e => Number(e.style.getPropertyValue("--system-item-opacity")));
    const paint = bindSaveSlotMotion(root, false, true);
    paint(1600 / slotTiming.enterMs, 1, "ready");
    expect(values(tabs)[0]).toBeGreaterThan(values(tabs)[1]);
    expect(values(tabs)[1]).toBeGreaterThan(values(tabs)[2]);
    expect(values(buttons)[0]).toBeGreaterThan(values(buttons)[1]);
    expect(root.querySelector<HTMLElement>(".abyssa-system-toolbar")!.style.opacity).toBe("");
    expect(root.querySelector<HTMLElement>(".save-slots__footer-actions")!.style.opacity).toBe("");
    paint(1, 940 / slotTiming.pageEnterMs, "entering");
    expect(values(tabs)).toEqual([1, 1, 1]);
    expect(values(buttons)).toEqual([1, 1]);
    paint(1, 1, "ready", false, .45);
    expect(values(tabs)[0]).toBeGreaterThan(values(tabs)[1]);
    expect(values(buttons)[0]).toBeGreaterThan(values(buttons)[1]);
    paint(1, 1, "ready");
    bindSaveSlotMotion(root, true, false)(1 - 1600 / slotTiming.enterMs, 1, "ready");
    expect(values(tabs)[0]).toBeGreaterThan(values(tabs)[1]);
    expect(values(buttons)[0]).toBeGreaterThan(values(buttons)[1]);
  });
});
