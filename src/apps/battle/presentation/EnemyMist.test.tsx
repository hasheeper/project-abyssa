import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnemyMist } from "./EnemyMist";
import { createEnemyMistRenderer } from "./enemy-mist-renderer";

vi.mock("./enemy-mist-renderer", () => ({ createEnemyMistRenderer: vi.fn() }));

let motion: EventTarget & { matches: boolean };
let hidden = false;
const renderer = { draw: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  motion = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", () => motion);
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.mocked(createEnemyMistRenderer).mockReturnValue(renderer);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EnemyMist render budget", () => {
  it("budgets GPU draws during dice motion without changing the clock or recreating the renderer", () => {
    const view = render(<EnemyMist foregroundBusy />);
    const initial = renderer.draw.mock.calls.length;
    const start = renderer.draw.mock.calls.at(-1)![0];
    advance(1000);
    expect(renderer.draw.mock.calls.length - initial).toBeGreaterThanOrEqual(7);
    expect(renderer.draw.mock.calls.length - initial).toBeLessThanOrEqual(8);
    expect(renderer.draw.mock.calls.at(-1)![0] - start).toBeGreaterThan(.8);
    const count = renderer.draw.mock.calls.length;
    view.rerender(<EnemyMist foregroundBusy={false} />);
    advance(1000);
    expect(renderer.draw.mock.calls.length - count).toBeGreaterThanOrEqual(22);
    expect(renderer.draw.mock.calls.length - count).toBeLessThanOrEqual(24);
    expect(createEnemyMistRenderer).toHaveBeenCalledOnce();
    expect(renderer.draw.mock.calls.at(-1)![0] - start).toBeGreaterThan(1.8);
  });

  it("caps drawing at 24fps and releases the loop and GPU resources on unmount", () => {
    const view = render(<EnemyMist />);
    const initial = renderer.draw.mock.calls.length;
    advance(1000);
    const frames = renderer.draw.mock.calls.length - initial;
    expect(frames).toBeGreaterThanOrEqual(22);
    expect(frames).toBeLessThanOrEqual(24);
    const times = renderer.draw.mock.calls.map(([seconds]) => seconds as number);
    expect(times.at(-1)! - times[0]!).toBeLessThanOrEqual(1);
    view.unmount();
    const count = renderer.draw.mock.calls.length;
    advance(1000);
    expect(renderer.draw).toHaveBeenCalledTimes(count);
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it("keeps reduced motion static and resumes without jumping after a hidden tab", () => {
    motion.matches = true;
    render(<EnemyMist />);
    advance(1000);
    expect(renderer.draw).toHaveBeenCalledOnce();
    act(() => { motion.matches = false; motion.dispatchEvent(new Event("change")); });
    advance(500);
    expect(renderer.draw.mock.calls.length).toBeGreaterThan(2);

    act(() => { hidden = true; document.dispatchEvent(new Event("visibilitychange")); });
    const count = renderer.draw.mock.calls.length;
    const lastTime = renderer.draw.mock.calls.at(-1)![0];
    advance(60_000);
    expect(renderer.draw).toHaveBeenCalledTimes(count);
    act(() => { hidden = false; document.dispatchEvent(new Event("visibilitychange")); });
    expect(renderer.draw.mock.calls.at(-1)![0]).toBe(lastTime);
    advance(100);
    expect(renderer.draw.mock.calls.length).toBeGreaterThan(count + 1);
  });

  it("stops on context loss, recreates on restore, and tolerates unavailable WebGL", () => {
    const view = render(<EnemyMist />);
    const canvas = view.container.querySelector("canvas")!;
    advance(100);
    act(() => { canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })); });
    const count = renderer.draw.mock.calls.length;
    advance(1000);
    expect(renderer.draw).toHaveBeenCalledTimes(count);
    act(() => { canvas.dispatchEvent(new Event("webglcontextrestored")); });
    expect(createEnemyMistRenderer).toHaveBeenCalledTimes(2);
    advance(100);
    expect(renderer.draw.mock.calls.length).toBeGreaterThan(count);
    view.unmount();

    vi.mocked(createEnemyMistRenderer).mockReturnValue(null);
    const fallback = render(<EnemyMist />);
    const before = renderer.draw.mock.calls.length;
    advance(1000);
    expect(renderer.draw).toHaveBeenCalledTimes(before);
    expect(fallback.container.querySelector("canvas")).toHaveAttribute("data-mist-ready", "false");
  });
});
