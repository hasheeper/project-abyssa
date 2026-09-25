import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { motionValue } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import { settingsSceneVisibility, settingsTiming } from "./settings-motion";
import type { SystemSceneMotion } from "../system-panel-motion";

type Clock = { get(): number; set(value: number): void };
type Flight = { value: Clock; target: number; stop: ReturnType<typeof vi.fn>; finish(): void };
const flights = vi.hoisted(() => [] as Flight[]);
vi.mock("motion/react", async original => ({
  ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: Clock, target: number) => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const flight = { value, target, stop: vi.fn(), finish: () => { value.set(target); resolve(); } };
    flights.push(flight); return Object.assign(promise, { stop: flight.stop });
  }),
}));
afterEach(() => { cleanup(); flights.length = 0; vi.clearAllMocks(); });
const finish = async (flight: Flight) => { await act(async () => flight.finish()); };
const presence = (element: Element) => Number((element as HTMLElement).style.getPropertyValue("--system-item-opacity"));
function mount() {
  const scene: SystemSceneMotion = { clock: motionValue(0), exiting: false, skip: false };
  const onBack = vi.fn();
  const view = render(<SettingsPanel embedded sceneMotion={scene} onBack={onBack} />);
  return { ...view, scene, onBack, user: userEvent.setup() };
}

describe("individual settings choreography", () => {
  it("stages each row, each tab and each bottom button, with no animated group wrapper", () => {
    const { scene, container } = mount();
    const rows = Array.from(container.querySelectorAll(".settings-row"));
    const tabs = screen.getAllByRole("tab");
    expect(rows.map(presence)).toEqual([0, 0, 0, 0, 0]);
    act(() => scene.clock.set(.27));
    expect(presence(rows[0])).toBeGreaterThan(presence(rows[1]));
    expect(presence(rows[1])).toBeGreaterThan(presence(rows[2]));
    expect(tabs.map(presence)).toEqual([0, 0, 0, 0]);
    act(() => scene.clock.set(.78));
    const alpha = tabs.map(presence);
    expect(alpha[0]).toBeGreaterThan(alpha[1]);
    expect(alpha[1]).toBeGreaterThan(alpha[2]);
    expect(alpha[2]).toBeGreaterThan(alpha[3]);
    expect(presence(screen.getByRole("button", { name: "恢复默认设置" }))).toBeGreaterThan(presence(screen.getByRole("button", { name: "返回" })));
    expect(container.querySelector(".abyssa-system-toolbar")).not.toHaveAttribute("data-system-motion-item");
    expect(container.querySelector(".abyssa-system-panel__footer")).not.toHaveAttribute("data-system-motion-item");
    expect(container.querySelector(".settings-app__panel")).not.toHaveAttribute("data-system-motion-item");
    act(() => scene.clock.set(1));
    expect(tabs.map(presence)).toEqual([1, 1, 1, 1]);
    // The same clock backwards retires items in reverse order.
    act(() => scene.clock.set(.78));
    expect(tabs.map(presence)).toEqual(alpha);
    act(() => scene.clock.set(0));
    expect(rows.map(presence)).toEqual([0, 0, 0, 0, 0]);
    expect(container.querySelector<HTMLElement>("main")!.style.getPropertyValue("--settings-surface-opacity")).toBe("0");
  });

  it("waits for the preview component before typing, and does not blank it on exit", () => {
    const { scene, container, rerender, onBack } = mount();
    expect(container.querySelector(".settings-preview")).toHaveAttribute("data-preview-waiting");
    act(() => scene.clock.set(.8));
    expect(container.querySelector(".settings-preview")).not.toHaveAttribute("data-preview-waiting");
    rerender(<SettingsPanel embedded sceneMotion={{ ...scene, exiting: true }} onBack={onBack} />);
    act(() => scene.clock.set(.6));
    expect(container.querySelector(".settings-preview")).not.toHaveAttribute("data-preview-waiting");
  });

  it("keeps every tab/footer action and backing visible during category swaps and commits only the latest category", async () => {
    const { scene, container, user } = mount();
    act(() => scene.clock.set(1));
    const tabs = screen.getAllByRole("tab");
    const footer = Array.from(container.querySelectorAll(".abyssa-system-panel__footer button"));
    await user.click(screen.getByRole("tab", { name: "Display" }));
    await user.click(screen.getByRole("tab", { name: "Model" }));
    expect(flights).toHaveLength(1);
    expect(flights[0].stop).not.toHaveBeenCalled();
    expect(screen.getByRole("slider", { name: "打字速度" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("inert");
    act(() => flights[0].value.set(.6));
    expect(tabs.map(presence)).toEqual([1, 1, 1, 1]);
    expect(footer.map(presence)).toEqual([1, 1]);
    expect(container.querySelector<HTMLElement>("main")!.style.getPropertyValue("--settings-surface-opacity")).toBe("1");
    await finish(flights[0]);
    expect(screen.getByRole("heading", { name: "服务连接" })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "打字速度" })).toBeNull();
    expect(Array.from(container.querySelectorAll(".airp-model"), presence)).toEqual([0, 0, 0]);
    expect(tabs.map(presence)).toEqual([1, 1, 1, 1]);
    expect(footer.map(presence)).toEqual([1, 1]);
    act(() => flights[1].value.set(.4));
    expect(tabs.map(presence)).toEqual([1, 1, 1, 1]);
    expect(footer.map(presence)).toEqual([1, 1]);
    await finish(flights[1]);
    expect(screen.getByRole("tabpanel")).not.toHaveAttribute("inert");
    expect(Array.from(container.querySelectorAll(".airp-model"), presence)).toEqual([1, 1, 1]);
    expect(screen.getAllByRole("tab")).toEqual(tabs);
    expect(Array.from(container.querySelectorAll(".abyssa-system-panel__footer button"))).toEqual(footer);
    expect(footer.map(presence)).toEqual([1, 1]);
  });

  it("does not replay for value edits and settles reduced/interrupted transitions safely", async () => {
    const { scene, container, user, rerender, onBack, unmount } = mount();
    act(() => scene.clock.set(1));
    fireEvent.change(screen.getByRole("slider", { name: "打字速度" }), { target: { value: "24" } });
    expect(flights).toHaveLength(0);
    expect(Array.from(container.querySelectorAll(".settings-row"), presence)).toEqual([1, 1, 1, 1, 1]);
    await user.click(screen.getByRole("tab", { name: "About" }));
    const old = flights[0];
    rerender(<SettingsPanel embedded sceneMotion={{ ...scene, skip: true }} onBack={onBack} />);
    expect(old.stop).toHaveBeenCalled();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("About");
    expect(container.querySelector("main")).toHaveAttribute("data-settings-tab-phase", "ready");
    expect(screen.getAllByRole("tab").map(presence)).toEqual([1, 1, 1, 1]);
    unmount(); await finish(old);
    expect(container.childElementCount).toBe(0);
  });

  it("finishes every control before the parent releases its transition lock", () => {
    for (const part of ["heading", "body", "chrome", "surface"] as const)
      for (let order = 0; order < 5; order++) expect(settingsSceneVisibility(1, part, order)).toBe(1);
    expect(settingsTiming.enterMs).toBeGreaterThan(settingsTiming.chromeStartMs + 4 * settingsTiming.chromeStaggerMs + settingsTiming.chromeMs);
  });
});
