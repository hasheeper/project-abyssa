import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsScene } from "./SettingsScene";
import { settingsTiming } from "./settings-motion";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";

type Clock = { get(): number; set(value: number): void };
type Flight = { value: Clock; target: number; duration: number; stop: ReturnType<typeof vi.fn>; finish(): void };
const flights = vi.hoisted(() => [] as Flight[]);
vi.mock("motion/react", async original => ({ ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: Clock, target: number, options: { duration: number }) => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const flight = { value, target, duration: options.duration, stop: vi.fn(), finish: () => { value.set(target); resolve(); } };
    flights.push(flight); return Object.assign(promise, { stop: flight.stop });
  }),
}));
afterEach(() => { cleanup(); flights.length = 0; vi.clearAllMocks(); });
const finish = async (flight: Flight) => { await act(async () => flight.finish()); };
const opacity = (element: Element) => Number((element as HTMLElement).style.getPropertyValue("--system-item-opacity"));
const rows = () => Array.from(document.querySelectorAll(".settings-row"));
const root = () => document.querySelector<HTMLElement>(".settings-scene")!;

it("shares the LOAD shell and enters individual rows, tabs and footer controls", async () => {
  render(<SettingsScene open onClose={vi.fn()} />);
  expect(root()).toHaveClass("system-scene");
  expect(document.querySelector(".abyssa-stage, .abyssa-rpg-header, .settings-app__frame")).toBeNull();
  expect(screen.getByRole("heading", { name: "系统设置SETTINGS" })).toHaveClass("system-scene__heading");
  expect(flights[0].duration).toBe(settingsTiming.enterMs / 1000);
  expect(rows().map(opacity)).toEqual([0, 0, 0, 0, 0]);
  act(() => flights[0].value.set(.27));
  expect(opacity(rows()[0])).toBeGreaterThan(opacity(rows()[1]));
  expect(opacity(rows()[1])).toBeGreaterThan(opacity(rows()[2]));
  expect(screen.getAllByRole("tab").map(opacity)).toEqual([0, 0, 0, 0]);
  act(() => flights[0].value.set(.78));
  const tabs = screen.getAllByRole("tab").map(opacity);
  expect(tabs[0]).toBeGreaterThan(tabs[1]);
  expect(tabs[1]).toBeGreaterThan(tabs[2]);
  expect(tabs[2]).toBeGreaterThan(tabs[3]);
  expect(opacity(screen.getByRole("button", { name: "恢复默认设置" }))).toBeGreaterThan(opacity(screen.getByRole("button", { name: "返回" })));
  await finish(flights[0]);
  expect(document.querySelector(".system-scene__interaction")).not.toHaveAttribute("inert");
  expect(rows().map(opacity)).toEqual([1, 1, 1, 1, 1]);
});

it("keeps the bilingual title, backdrop and navigation fixed during category transitions", async () => {
  render(<SettingsScene open onClose={vi.fn()} />); await finish(flights[0]);
  const heading = screen.getByRole("heading", { name: "系统设置SETTINGS" });
  const backdrop = document.querySelector(".system-scene__backdrop");
  const tabs = screen.getAllByRole("tab");
  const buttons = Array.from(document.querySelectorAll(".abyssa-system-panel__footer button"));
  fireEvent.click(screen.getByRole("tab", { name: "Display" }));
  act(() => flights[1].value.set(.5));
  expect(screen.getByRole("heading", { name: "系统设置SETTINGS" })).toBe(heading);
  expect(heading).not.toHaveAttribute("data-system-motion-item");
  expect(root().style.getPropertyValue("--system-scene-heading")).toBe("1");
  expect(root().style.getPropertyValue("--system-scene-surface")).toBe("1");
  expect(document.querySelector(".system-scene__backdrop")).toBe(backdrop);
  expect(tabs.map(opacity)).toEqual([1, 1, 1, 1]);
  expect(buttons.map(opacity)).toEqual([1, 1]);
  expect(screen.getByRole("tabpanel")).toHaveAttribute("inert");
  await finish(flights[1]); await finish(flights[2]);
  expect(screen.getByRole("heading", { name: "视觉显示" })).toBeInTheDocument();
  expect(screen.getByRole("tabpanel")).not.toHaveAttribute("inert");
  expect(tabs.map(opacity)).toEqual([1, 1, 1, 1]);
});

it("retains input ownership through the reverse exit and hands off only at removal", async () => {
  const onClose = vi.fn(), onExited = vi.fn(), onPresent = vi.fn();
  const props = { onClose, onExited, onPresentChange: onPresent };
  const view = render(<SettingsScene open {...props} />); await finish(flights[0]);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", repeat: true });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", isComposing: true });
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
  view.rerender(<SettingsScene open={false} {...props} />);
  const exit = flights.at(-1)!;
  expect(exit.duration).toBe(settingsTiming.exitMs / 1000);
  act(() => exit.value.set(.55));
  expect(screen.getAllByRole("tab").map(opacity)).toEqual([0, 0, 0, 0]);
  expect(opacity(rows()[0])).toBe(1);
  expect(document.querySelector(".system-scene__interaction")).toHaveAttribute("inert");
  expect(onPresent).not.toHaveBeenCalledWith(false);
  expect(onExited).not.toHaveBeenCalled();
  await finish(exit);
  expect(onExited).toHaveBeenCalledOnce();
  expect(onPresent).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("reopens from the visible pose and settles a live reduced-motion change", async () => {
  const onClose = vi.fn();
  const content = (open: boolean, reduced = false) => <UiMotionProvider preference={reduced ? "reduced" : "system"}>
    <SettingsScene open={open} onClose={onClose} />
  </UiMotionProvider>;
  const view = render(content(true));
  act(() => flights[0].value.set(.35));
  view.rerender(content(false));
  const exit = flights.at(-1)!;
  act(() => exit.value.set(.22));
  const pose = rows().map(opacity), surface = root().style.getPropertyValue("--system-scene-surface");
  view.rerender(content(true));
  expect(exit.stop).toHaveBeenCalled();
  expect(rows().map(opacity)).toEqual(pose);
  expect(root().style.getPropertyValue("--system-scene-surface")).toBe(surface);
  view.rerender(content(true, true));
  expect(rows().map(opacity)).toEqual([1, 1, 1, 1, 1]);
  expect(root().style.getPropertyValue("--system-scene-surface")).toBe("1");
  expect(flights.at(-1)!.duration).toBe(0);
  await finish(flights.at(-1)!);
  await act(async () => { view.unmount(); exit.finish(); });
  expect(screen.queryByRole("dialog")).toBeNull();
});
