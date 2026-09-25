import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { MenuSystemBackdrop } from "./MenuSystemBackdrop";
import { motionTokens } from "../../shared/ui/motion/presets";
import type { MenuView } from "./useMenuView";

type Clock = { get(): number; set(value: number): void };
type Flight = { value: Clock; target: number; duration: number; delay: number; stop: ReturnType<typeof vi.fn> };
const flights = vi.hoisted(() => [] as Flight[]);
vi.mock("motion/react", async original => ({
  ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: Clock, target: number, options: { duration: number; delay: number }) => {
    const flight = { value, target, ...options, stop: vi.fn() };
    flights.push(flight); return flight;
  }),
}));
afterEach(() => { cleanup(); flights.length = 0; vi.clearAllMocks(); });

it("does not fade or replace the shared surface during any system-section switch", () => {
  const view = render(<StrictMode><MenuSystemBackdrop displayed="home" target="home" skip={false} /></StrictMode>);
  const surface = view.container.querySelector(".menu-system-backdrop");
  expect(surface).toHaveAttribute("aria-hidden", "true");
  expect(flights).toHaveLength(0);
  view.rerender(<StrictMode><MenuSystemBackdrop displayed="home" target="save" skip={false} /></StrictMode>);
  expect(flights).toHaveLength(0); // Home's existing exit still owns this interval.
  view.rerender(<StrictMode><MenuSystemBackdrop displayed="save" target="save" skip={false} /></StrictMode>);
  expect(flights).toHaveLength(1);
  const entrance = flights[0];
  expect(entrance.duration).toBe(motionTokens.saveSlots.surfaceMs / 1000);
  act(() => entrance.value.set(.4));
  view.rerender(<StrictMode><MenuSystemBackdrop displayed="save" target="settings" skip={false} /></StrictMode>);
  view.rerender(<StrictMode><MenuSystemBackdrop displayed="settings" target="settings" skip={false} /></StrictMode>);
  expect(flights).toHaveLength(1);
  expect(entrance.stop).not.toHaveBeenCalled();
  expect(entrance.value.get()).toBe(.4); // Do not snap an unfinished entrance to 1.
  act(() => entrance.value.set(1));
  for (const displayed of ["save", "load", "settings"] as const) for (const target of ["save", "load", "settings"] as const) {
    view.rerender(<StrictMode><MenuSystemBackdrop displayed={displayed} target={target} skip={false} /></StrictMode>);
    expect(view.container.querySelector(".menu-system-backdrop")).toBe(surface);
    expect(entrance.value.get()).toBe(1);
    expect(flights).toHaveLength(1);
  }
});

it.each(["save", "load", "settings"] as const)("fades %s out only at the home boundary and reverses from live alpha", displayed => {
  const view = render(<MenuSystemBackdrop displayed={displayed} target={displayed} skip={false} />);
  const entrance = flights[0];
  act(() => entrance.value.set(1));
  view.rerender(<MenuSystemBackdrop displayed={displayed} target="home" skip={false} />);
  const exit = flights[1];
  const timing = displayed === "settings" ? motionTokens.settingsPanel : motionTokens.saveSlots;
  expect(exit.target).toBe(0);
  expect(exit.delay).toBeGreaterThan(0);
  expect(exit.delay + exit.duration).toBeCloseTo(timing.exitMs / 1000);
  act(() => exit.value.set(.45));
  view.rerender(<MenuSystemBackdrop displayed={displayed} target="settings" skip={false} />);
  expect(exit.stop).toHaveBeenCalledOnce();
  expect(flights[2].value.get()).toBe(.45);
  expect(flights[2].target).toBe(1);
  expect(flights[2].delay).toBe(0);
  act(() => flights[2].value.set(1));
  view.rerender(<MenuSystemBackdrop displayed={displayed} target="home" skip={false} />);
  act(() => flights[3].value.set(0));
  view.rerender(<MenuSystemBackdrop displayed="home" target="home" skip={false} />);
  expect(flights).toHaveLength(4);
  expect(exit.value.get()).toBe(0);
});

it("settles reduced/backgrounded transitions and cancels animation on unmount", () => {
  const renderState = (displayed: MenuView, target: MenuView, skip: boolean) => <MenuSystemBackdrop displayed={displayed} target={target} skip={skip} />;
  const view = render(renderState("settings", "settings", false));
  const entrance = flights[0];
  act(() => entrance.value.set(.2));
  view.rerender(renderState("settings", "settings", true));
  expect(entrance.stop).toHaveBeenCalledOnce();
  expect(entrance.value.get()).toBe(1);
  view.rerender(renderState("home", "home", true));
  expect(entrance.value.get()).toBe(0);
  view.rerender(renderState("load", "load", false));
  const active = flights.at(-1)!;
  view.unmount();
  expect(active.stop).toHaveBeenCalledOnce();
});
