import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTitleParallax } from "./useTitleParallax";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";

let reduced: boolean;
let fine: boolean;
let preferenceChanged: Set<() => void>;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false; fine = true; preferenceChanged = new Set();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("reduced-motion") ? reduced : fine; },
    addEventListener: (_: string, listener: () => void) => preferenceChanged.add(listener),
    removeEventListener: (_: string, listener: () => void) => preferenceChanged.delete(listener)
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function Scene({ blocked = false }: { blocked?: boolean }) {
  const ref = useTitleParallax(blocked);
  return <div ref={ref} data-testid="scene"><div className="title-cg-layer"/><div className="title-backdrop"/></div>;
}
function mount() {
  const view = render(<Scene />), scene = screen.getByTestId("scene");
  vi.spyOn(scene, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50, width: 800, height: 450 } as DOMRect);
  return { ...view, scene };
}
function move(scene: HTMLElement, pointerType = "mouse") {
  const event = new MouseEvent("pointermove", { clientX: 900, clientY: 275 });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(scene, event);
}
const settle = () => act(() => vi.advanceTimersByTime(1600));
const x = (scene: HTMLElement) => Number(scene.style.getPropertyValue("--title-look-x"));

it("normalizes against the scaled, letterboxed host and stops animation when settled", () => {
  const { scene } = mount();
  move(scene);
  act(() => vi.advanceTimersByTime(32));
  expect(x(scene)).toBeGreaterThan(0);
  expect(x(scene)).toBeLessThan(1);
  settle();
  expect(x(scene)).toBe(1);
  for (const layer of scene.children) expect(x(layer as HTMLElement)).toBe(1);
  expect(Number(scene.style.getPropertyValue("--title-look-y"))).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.pointerLeave(scene);
  settle();
  expect(x(scene)).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("returns smoothly for a modal, ignores pointer input while blocked, and cancels on unmount", () => {
  const { scene, rerender, unmount } = mount();
  move(scene); settle();
  rerender(<Scene blocked />);
  expect(x(scene)).toBe(1);
  settle();
  expect(x(scene)).toBe(0);
  move(scene); settle();
  expect(x(scene)).toBe(0);
  rerender(<Scene />);
  move(scene);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(preferenceChanged.size).toBe(0);
});

it("leaves touch/coarse pointers still and immediately honors a reduced-motion change", () => {
  const { scene } = mount();
  move(scene, "touch"); settle();
  expect(x(scene)).toBe(0);
  fine = false;
  move(scene); settle();
  expect(x(scene)).toBe(0);
  fine = true;
  move(scene); settle();
  expect(x(scene)).toBe(1);
  reduced = true;
  act(() => preferenceChanged.forEach(listener => listener()));
  expect(x(scene)).toBe(0);
  move(scene); settle();
  expect(x(scene)).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("honors manual reduction live, and resets on blur and page hiding", () => {
  const { scene, rerender } = mount();
  move(scene); settle();
  fireEvent(window, new Event("blur")); settle();
  expect(x(scene)).toBe(0);
  move(scene); settle();
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(x(scene)).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  vi.restoreAllMocks();
  rerender(<UiMotionProvider preference="system"><Scene/></UiMotionProvider>);
  const current = screen.getByTestId("scene");
  vi.spyOn(current, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50, width: 800, height: 450 } as DOMRect);
  move(current); settle();
  expect(x(current)).toBe(1);
  rerender(<UiMotionProvider preference="reduced"><Scene/></UiMotionProvider>);
  expect(x(current)).toBe(0);
  move(current); settle();
  expect(x(current)).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
