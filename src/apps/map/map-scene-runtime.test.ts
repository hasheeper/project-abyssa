import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMapSceneRuntime } from "./map-scene-runtime";

let frameCallback: FrameRequestCallback | undefined;
let requestFrame: ReturnType<typeof vi.fn>;
let cancelFrame: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  requestFrame = vi.fn((callback: FrameRequestCallback) => {
    frameCallback = callback;
    return 42;
  });
  cancelFrame = vi.fn();
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createMapSceneRuntime", () => {
  it("starts rendering, wires interactions and schedules the entrance replay", () => {
    const element = document.createElement("canvas");
    const onFrame = vi.fn();
    const onResize = vi.fn();
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const replay = vi.fn();
    const runtime = createMapSceneRuntime({
      element,
      onFrame,
      onResize,
      onPointerDown,
      onPointerMove,
      onDestroy: vi.fn()
    });

    expect(onFrame).toHaveBeenCalledOnce();
    expect(requestFrame).toHaveBeenCalledOnce();
    element.dispatchEvent(new PointerEvent("pointerdown"));
    element.dispatchEvent(new PointerEvent("pointermove"));
    window.dispatchEvent(new Event("resize"));
    expect(onPointerDown).toHaveBeenCalledOnce();
    expect(onPointerMove).toHaveBeenCalledOnce();
    expect(onResize).toHaveBeenCalledOnce();

    frameCallback?.(16);
    expect(onFrame).toHaveBeenCalledTimes(2);
    runtime.scheduleReplay(replay, 200);
    vi.advanceTimersByTime(199);
    expect(replay).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(replay).toHaveBeenCalledOnce();
  });

  it("cancels every browser resource and destroys the scene exactly once", () => {
    const element = document.createElement("canvas");
    const onFrame = vi.fn();
    const onResize = vi.fn();
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onDestroy = vi.fn();
    const replay = vi.fn();
    const runtime = createMapSceneRuntime({
      element,
      onFrame,
      onResize,
      onPointerDown,
      onPointerMove,
      onDestroy
    });
    runtime.scheduleReplay(replay, 200);

    runtime.destroy();
    runtime.destroy();

    expect(runtime.destroyed).toBe(true);
    expect(cancelFrame).toHaveBeenCalledOnce();
    expect(cancelFrame).toHaveBeenCalledWith(42);
    expect(onDestroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(200);
    expect(replay).not.toHaveBeenCalled();
    element.dispatchEvent(new PointerEvent("pointerdown"));
    element.dispatchEvent(new PointerEvent("pointermove"));
    window.dispatchEvent(new Event("resize"));
    frameCallback?.(32);
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onPointerMove).not.toHaveBeenCalled();
    expect(onResize).not.toHaveBeenCalled();
    expect(onFrame).toHaveBeenCalledOnce();
  });
});
