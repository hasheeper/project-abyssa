import { useRef } from "react";
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { animate } from "motion/react";
import { useMenuView } from "./useMenuView";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { motionTokens } from "../../shared/ui/motion/presets";

type Clock = { get(): number; set(value: number): void };
type Flight = { value: Clock; target: number; duration: number; stop: ReturnType<typeof vi.fn>; finish(): void };
const flights = vi.hoisted(() => [] as Flight[]);
vi.mock("motion/react", async original => ({
  ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: Clock, target: number, options: { duration: number }) => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const flight = { value, target, duration: options.duration, stop: vi.fn(), finish: () => { value.set(target); resolve(); } };
    flights.push(flight);
    return Object.assign(promise, { stop: flight.stop });
  }),
}));
afterEach(() => { cleanup(); flights.length = 0; vi.clearAllMocks(); vi.restoreAllMocks(); });
const mount = () => renderHook(() => useMenuView(useRef<HTMLDivElement>(null)), { wrapper: StrictMode });
const finish = async (batch = [...flights]) => { await act(async () => { batch.forEach(flight => flight.finish()); }); };

it("does not replay initial mount; completes one exit to the latest requested section", async () => {
  const { result } = mount();
  expect(animate).not.toHaveBeenCalled();
  act(() => result.current.request("save"));
  expect(flights[0].duration).toBe(motionTokens.menuSection.homeExitMs / 1000);
  expect(result.current.displayed).toBe("home");
  act(() => result.current.request("load"));
  act(() => result.current.request("settings"));
  expect(flights).toHaveLength(1);
  expect(flights[0].stop).not.toHaveBeenCalled();
  await finish();
  expect(result.current.displayed).toBe("settings");
  expect(result.current.phase).toBe("entering");
  await finish(flights.slice(1));
  expect(result.current.phase).toBe("ready");
});

it("reverses halfway from its live clock without jumping or replaying a full entrance", async () => {
  const { result } = mount();
  act(() => result.current.request("save"));
  const exit = flights[0];
  act(() => exit.value.set(590));
  act(() => result.current.request("home"));
  expect(exit.stop).toHaveBeenCalledOnce();
  expect(flights[1].value.get()).toBe(590);
  expect(flights[1].duration).toBe(.59);
  await finish([flights[1]]);
  expect(result.current.displayed).toBe("home");
  expect(result.current.phase).toBe("ready");
});

it("returns home on the layered entrance clock after the section has fully left", async () => {
  const { result } = mount();
  act(() => result.current.request("load")); await finish(); await finish(flights.slice(1));
  const start = flights.length;
  act(() => result.current.request("home"));
  expect(result.current.displayed).toBe("load");
  await finish(flights.slice(start));
  expect(result.current.displayed).toBe("home");
  const entrance = flights.at(-1)!;
  expect(entrance.value.get()).toBe(0);
  expect(entrance.duration).toBe(1.18);
  await finish([entrance]);
  expect(result.current.phase).toBe("ready");
});

it("settles hidden/reduced transitions and cancels unfinished work on unmount", async () => {
  const { result, unmount } = mount();
  act(() => result.current.request("save"));
  const old = flights[0];
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(old.stop).toHaveBeenCalledOnce();
  expect(result.current.displayed).toBe("save");
  expect(result.current.transitioning).toBe(false);
  unmount();
  await finish([old]); // A stale completion must never remount the retired view.
  vi.restoreAllMocks();
  const reduced = renderHook(() => useMenuView(useRef<HTMLDivElement>(null)), {
    wrapper: ({ children }) => <UiMotionProvider preference="reduced">{children}</UiMotionProvider>,
  });
  const count = flights.length;
  act(() => reduced.result.current.request("settings"));
  expect(flights).toHaveLength(count);
  expect(reduced.result.current.displayed).toBe("settings");
});

it("draws the rails while reading, then resumes without resetting the entrance clock", async () => {
  const { result } = renderHook(() => useMenuView(useRef<HTMLDivElement>(null), true));
  act(() => result.current.request("load")); await finish();
  const waiting = flights.slice(1);
  await finish(waiting);
  const hold = motionTokens.saveSlots.railHoldMs / motionTokens.saveSlots.enterMs;
  expect(result.current.archiveMotion.clock.get()).toBe(hold);
  expect(result.current.phase).toBe("entering");
  const samples: number[] = [];
  const stop = result.current.archiveMotion.clock.on("change", value => samples.push(value));
  act(() => result.current.archiveMotion.onReady(true));
  expect(result.current.archiveMotion.clock.get()).toBe(hold);
  await finish(flights.slice(1 + waiting.length));
  expect(result.current.phase).toBe("ready");
  expect(samples.every(value => value >= hold)).toBe(true);
  stop();
});

it("does not reset an outgoing archive clock before its tree unmounts", async () => {
  const { result } = mount();
  act(() => result.current.request("load")); await finish(); await finish(flights.slice(1));
  const start = flights.length;
  act(() => result.current.request("settings"));
  const samples: number[] = [];
  const stop = result.current.archiveMotion.clock.on("change", value => samples.push(value));
  await finish(flights.slice(start));
  expect(result.current.displayed).toBe("settings");
  expect(samples).toEqual([1]); // No final 0 repaint of the retiring rail/cards.
  stop();
});

it("cross-fades SAVE/LOAD contents without restarting rails, and keeps the shared title slide", async () => {
  const { result } = mount();
  act(() => result.current.request("load")); await finish(); await finish(flights.slice(1));
  const start = flights.length;
  const samples: number[] = [];
  const stop = result.current.archiveMotion.clock.on("change", value => samples.push(value));
  act(() => result.current.request("save"));
  expect(result.current.archiveMotion.exiting).toBe(false);
  expect(flights.slice(start)).toHaveLength(3);
  expect(flights[start].duration).toBe(motionTokens.saveSlots.modeOutMs / 1000);
  expect(flights[start + 2].target).toBe(-motionTokens.menuSection.withdrawPx);
  expect(flights[start + 2].duration).toBe(.36);
  await finish(flights.slice(start));
  expect(result.current.displayed).toBe("save");
  expect(result.current.titleX.get()).toBe(-motionTokens.menuSection.withdrawPx);
  expect(flights.some(flight => flight.value === result.current.titleX && flight.target === 0 && flight.duration === .68)).toBe(true);
  await finish(flights.slice(start + 3));
  expect(result.current.phase).toBe("ready");
  expect(result.current.archiveMotion.modeOpacity.get()).toBe(1);
  expect(samples).toEqual([]);
  stop();
});
