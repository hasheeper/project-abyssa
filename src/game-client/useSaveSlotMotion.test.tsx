import { StrictMode, useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { motionValue } from "motion/react";
import { initialSaveSlots } from "../game-runtime/save-slots";
import { SaveSlotGrid } from "./SaveSlotGrid";
import { useSaveSlotMotion } from "./useSaveSlotMotion";
import type { SaveSlotSceneMotion } from "./save-slots-motion";

type Clock = { get(): number; set(value: number): void };
type Flight = { value: Clock; stop: ReturnType<typeof vi.fn>; finish(): void };
const flights = vi.hoisted(() => [] as Flight[]);
vi.mock("motion/react", async original => ({
  ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: Clock, target: number) => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const flight = { value, stop: vi.fn(), finish: () => { value.set(target); resolve(); } };
    flights.push(flight);
    return Object.assign(promise, { stop: flight.stop });
  }),
}));
afterEach(() => { cleanup(); flights.length = 0; vi.clearAllMocks(); });
const finish = async (flight: Flight) => { await act(async () => flight.finish()); };
const scene = (): SaveSlotSceneMotion => ({ clock: motionValue(0), modeOpacity: motionValue(1), exiting: false, skip: false, onReady: vi.fn() });
function Harness({ page = 0, ready = true, motion }: { page?: number; ready?: boolean; motion: SaveSlotSceneMotion }) {
  const root = useRef<HTMLElement>(null);
  const state = useSaveSlotMotion(root, page, ready, motion);
  return <main ref={root} data-phase={state.phase}>
    <div className="abyssa-system-toolbar"><nav className="abyssa-system-tabs"><button>01—10</button><button>11—20</button><button>21—30</button></nav>
      <div className="abyssa-system-toolbar__actions"><button>导入</button></div></div>
    <SaveSlotGrid index={ready ? initialSaveSlots([]) : null} saves={[]} selected={page * 10} page={state.page} changing={state.changing}
      loading={!ready} disabled={false} onSelect={vi.fn()} onActivate={vi.fn()} onExport={vi.fn()} />
    <footer className="abyssa-system-panel__footer"><div className="save-slots__footer-actions"><button>返回</button><button>保存</button></div></footer>
  </main>;
}

it("keeps live rail progress when the loading skeleton becomes records", () => {
  const motion = scene();
  const view = render(<StrictMode><Harness motion={motion} ready={false} /></StrictMode>);
  act(() => motion.clock.set(.15));
  const rail = view.container.querySelector<HTMLElement>(".save-slots__rail")!;
  const reveal = rail.style.getPropertyValue("--slot-rail-scale");
  view.rerender(<StrictMode><Harness motion={motion} ready /></StrictMode>);
  expect(view.container.querySelector(".save-slots__rail")).toBe(rail);
  expect(rail.style.getPropertyValue("--slot-rail-scale")).toBe(reveal);
  expect(view.container.querySelector<HTMLElement>(".save-slots__body")!.style.opacity).toBe("0");
  act(() => motion.clock.set(1));
  expect(view.container.querySelector<HTMLElement>(".save-slots__body")!.style.opacity).toBe("1");
});

it("retires only old page records, leaving rails and every navigation control mounted and visible", async () => {
  const motion = scene(); const view = render(<Harness motion={motion} />);
  act(() => motion.clock.set(1));
  const rail = view.container.querySelector<HTMLElement>(".save-slots__rail")!;
  const controls = Array.from(view.container.querySelectorAll<HTMLElement>("[data-system-motion-item]"));
  const expectControlsVisible = () => {
    expect(Array.from(view.container.querySelectorAll("[data-system-motion-item]"))).toEqual(controls);
    expect(controls.map(item => item.style.getPropertyValue("--system-item-opacity"))).toEqual(Array(6).fill("1"));
  };
  expectControlsVisible();
  view.rerender(<Harness motion={motion} page={1} />);
  expect(screen.getByRole("button", { name: "槽位 01 · 空白存档" })).toBeInTheDocument();
  expect(view.container.querySelector(".save-slots__grid")).toHaveAttribute("inert");
  act(() => flights[0].value.set(.6));
  expect(rail.style.getPropertyValue("--slot-rail-scale")).toBe("1");
  expectControlsVisible();
  await finish(flights[0]);
  expect(screen.queryByRole("button", { name: "槽位 01 · 空白存档" })).toBeNull();
  const body = screen.getByRole("button", { name: "槽位 11 · 空白存档" }).querySelector<HTMLElement>(".save-slots__body")!;
  expect(body.style.opacity).toBe("0");
  expect(view.container.querySelector(".save-slots__rail")).toBe(rail);
  expectControlsVisible();
  act(() => flights[1].value.set(.4));
  expectControlsVisible();
  await finish(flights[1]);
  expect(body.style.opacity).toBe("1");
  expect(view.container.querySelector(".save-slots__grid")).not.toHaveAttribute("inert");
  expectControlsVisible();
});

it("captures the visible pose before resetting a direction clock, including during paging", async () => {
  const motion = scene(); const view = render(<Harness motion={motion} />);
  act(() => motion.clock.set(1));
  view.rerender(<Harness motion={motion} page={1} />);
  act(() => flights[0].value.set(.6));
  const body = view.container.querySelector<HTMLElement>(".save-slots__body")!;
  const pose = [body.style.opacity, body.style.translate];
  view.rerender(<Harness motion={{ ...motion, exiting: true }} page={1} />);
  expect([body.style.opacity, body.style.translate]).toEqual(pose);
  act(() => motion.clock.set(0));
  expect([body.style.opacity, body.style.translate]).toEqual(pose);
  expect(flights[0].stop).toHaveBeenCalled();
  act(() => motion.clock.set(1));
  expect(body.style.opacity).toBe("0");
  await finish(flights[0]);
  expect(screen.queryByRole("button", { name: "槽位 11 · 空白存档" })).toBeNull();
});

it("settles reduced motion and ignores a stopped page completion after unmount", async () => {
  const motion = scene(); const view = render(<Harness motion={motion} />);
  act(() => motion.clock.set(1));
  view.rerender(<Harness motion={motion} page={1} />);
  const leaving = flights[0];
  view.rerender(<Harness motion={{ ...motion, skip: true }} page={1} />);
  expect(leaving.stop).toHaveBeenCalled();
  expect(view.container.querySelector("main")).toHaveAttribute("data-phase", "ready");
  expect(screen.getByRole("button", { name: "槽位 11 · 空白存档" }).querySelector<HTMLElement>(".save-slots__body")!.style.opacity).toBe("1");
  view.unmount();
  await finish(leaving);
  expect(view.container.childElementCount).toBe(0);
});
