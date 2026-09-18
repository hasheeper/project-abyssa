import { StrictMode, useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { useMenuParallax } from "./useMenuParallax";

let reduced: boolean;
let fine: boolean;
let preferences: Set<() => void>;
const renders = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false; fine = true; preferences = new Set(); renders.mockClear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("reduced-motion") ? reduced : fine; },
    addEventListener: (_: string, listener: () => void) => preferences.add(listener),
    removeEventListener: (_: string, listener: () => void) => preferences.delete(listener)
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Scene({ blocked = false }: { blocked?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useMenuParallax(ref, blocked);
  renders();
  return <div ref={ref} data-testid="scene">
    <div className="menu-scenery" /><svg className="menu-backdrop" />
    <div className="menu-app__host" /><header className="menu-topbar" />
    <nav className="menu-sidebar" /><div className="menu-app__dial"><button>command</button></div>
  </div>;
}
function bounds(scene: HTMLElement) {
  vi.spyOn(scene, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50, width: 800, height: 450 } as DOMRect);
  return scene;
}
function mount() {
  const view = render(<StrictMode><Scene /></StrictMode>);
  return { ...view, scene: bounds(screen.getByTestId("scene")) };
}
function move(scene: HTMLElement, pointerType = "mouse", movementX = 1) {
  const event = new MouseEvent("pointermove", { clientX: 900, clientY: 275 });
  Object.defineProperties(event, { pointerType: { value: pointerType }, movementX: { value: movementX } });
  fireEvent(scene, event);
}
const advance = (ms = 1800) => act(() => vi.advanceTimersByTime(ms));
const x = (scene: HTMLElement) => Number((scene.firstElementChild as HTMLElement).style.getPropertyValue("--menu-look-x"));

it("smooths scaled/letterboxed input on six planes without rerenders or an idle loop", () => {
  const { scene } = mount();
  const before = renders.mock.calls.length;
  move(scene);
  advance(32);
  expect(x(scene)).toBeGreaterThan(0);
  expect(x(scene)).toBeLessThan(1);
  expect(scene).toHaveAttribute("data-menu-looking");
  advance();
  expect(x(scene)).toBe(1);
  for (const layer of scene.children) {
    expect((layer as HTMLElement).style.getPropertyValue("--menu-look-x")).toBe("1.0000");
    expect((layer as HTMLElement).style.getPropertyValue("--menu-look-y")).toBe("0.0000");
  }
  expect(scene.style.getPropertyValue("--menu-look-x")).toBe("");
  expect(renders).toHaveBeenCalledTimes(before);
  expect(vi.getTimerCount()).toBe(0);
  expect(scene).not.toHaveAttribute("data-menu-looking");
  fireEvent.pointerLeave(scene);
  advance(32);
  expect(x(scene)).toBeGreaterThan(0);
  expect(x(scene)).toBeLessThan(1);
  advance();
  expect(x(scene)).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("freezes the hit target while pressed and resumes only on subsequent pointer movement", () => {
  const { scene } = mount();
  move(scene); advance(32);
  const held = x(scene);
  fireEvent.pointerDown(screen.getByRole("button"));
  move(scene); advance();
  expect(x(scene)).toBe(held);
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.pointerUp(window);
  advance();
  expect(x(scene)).toBe(held);
  move(scene); advance();
  expect(x(scene)).toBe(1);
});

it("centers for keyboard input and ignores synthetic stationary moves after focus", () => {
  const { scene } = mount();
  move(scene); advance();
  fireEvent.keyDown(document.body, { key: "Tab" });
  move(scene, "mouse", 0); advance();
  expect(x(scene)).toBe(0);
  move(scene); advance();
  expect(x(scene)).toBe(1);
});

it("centers on departure, ignores blocked input, and cleans up StrictMode/unmount listeners", () => {
  const { scene, rerender, unmount } = mount();
  move(scene); advance();
  rerender(<StrictMode><Scene blocked /></StrictMode>);
  expect(x(scene)).toBe(1);
  advance();
  expect(x(scene)).toBe(0);
  move(scene); advance();
  expect(x(scene)).toBe(0);
  rerender(<StrictMode><Scene /></StrictMode>);
  move(scene);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(preferences.size).toBe(0);
});

it("keeps touch/coarse pointers still and honors system reduction immediately", () => {
  const { scene } = mount();
  move(scene, "touch"); advance();
  expect(x(scene)).toBe(0);
  fine = false;
  move(scene); advance();
  expect(x(scene)).toBe(0);
  fine = true;
  move(scene); advance();
  expect(x(scene)).toBe(1);
  reduced = true;
  act(() => preferences.forEach(listener => listener()));
  expect(x(scene)).toBe(0);
  move(scene); advance();
  expect(x(scene)).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("honors manual reduction, blur, and document hiding without replay on return", () => {
  const view = render(<UiMotionProvider preference="system"><Scene /></UiMotionProvider>);
  const scene = bounds(screen.getByTestId("scene"));
  move(scene); advance();
  fireEvent(window, new Event("blur")); advance();
  expect(x(scene)).toBe(0);
  move(scene); advance();
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(x(scene)).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  expect(vi.getTimerCount()).toBe(0);
  move(scene); advance();
  view.rerender(<UiMotionProvider preference="reduced"><Scene /></UiMotionProvider>);
  expect(x(scene)).toBe(0);
  move(scene); advance();
  expect(x(scene)).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
