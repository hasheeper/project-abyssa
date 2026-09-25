import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useFeedbackLifetime } from "./useFeedbackLifetime";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

it("starts readable dwell only after entry completes and calls back once", () => {
  const onElapsed = vi.fn();
  const { rerender } = renderHook(({ ready }) => useFeedbackLifetime({ durationMs: 1000, ready, paused: false, onElapsed }), { initialProps: { ready: false } });
  advance(4000); expect(onElapsed).not.toHaveBeenCalled();
  rerender({ ready: true }); advance(999); expect(onElapsed).not.toHaveBeenCalled();
  advance(1); expect(onElapsed).toHaveBeenCalledOnce();
  rerender({ ready: false }); rerender({ ready: true }); advance(5000);
  expect(onElapsed).toHaveBeenCalledOnce();
});

it("preserves remaining time through host pause and document hiding", () => {
  const onElapsed = vi.fn();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const { rerender } = renderHook(({ paused }) => useFeedbackLifetime({ durationMs: 1000, ready: true, paused, onElapsed }), { initialProps: { paused: false } });
  advance(250); rerender({ paused: true }); advance(5000);
  expect(onElapsed).not.toHaveBeenCalled();
  rerender({ paused: false }); advance(250);
  act(() => { visibility.mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange")); });
  advance(5000); expect(onElapsed).not.toHaveBeenCalled();
  act(() => { visibility.mockReturnValue("visible"); document.dispatchEvent(new Event("visibilitychange")); });
  advance(499); expect(onElapsed).not.toHaveBeenCalled();
  advance(1); expect(onElapsed).toHaveBeenCalledOnce();
});

it("uses the current callback without extending the original presentation lifetime", () => {
  const before = vi.fn(), after = vi.fn();
  const { rerender } = renderHook(props => useFeedbackLifetime({ ready: true, paused: false, ...props }), { initialProps: { durationMs: 1000, onElapsed: before } });
  advance(600); rerender({ durationMs: 9000, onElapsed: after }); advance(400);
  expect(before).not.toHaveBeenCalled(); expect(after).toHaveBeenCalledOnce();
});

it("keeps persistent feedback, cancels on unmount, and tolerates StrictMode effects", () => {
  const persistent = vi.fn(), removed = vi.fn();
  const view = renderHook(() => useFeedbackLifetime({ durationMs: null, ready: true, paused: false, onElapsed: persistent }));
  advance(60000); expect(persistent).not.toHaveBeenCalled(); view.unmount();
  const mounted = renderHook(() => useFeedbackLifetime({ durationMs: 1000, ready: true, paused: false, onElapsed: removed }), { wrapper: StrictMode });
  advance(500); mounted.unmount(); advance(2000); expect(removed).not.toHaveBeenCalled();
  renderHook(() => useFeedbackLifetime({ durationMs: 1000, ready: true, paused: false, onElapsed: removed }), { wrapper: StrictMode });
  advance(1000); expect(removed).toHaveBeenCalledOnce();
});
