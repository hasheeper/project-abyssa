import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { motionValue } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { codexSamples } from "./codex-preview";
import { CodexPanel } from "./CodexPanel";
import type { SystemSceneMotion } from "../system-panel-motion";

type Clock = { get(): number; set(value: number): void };
type Flight = { value: Clock; stop: ReturnType<typeof vi.fn>; finish(): void };
const flights = vi.hoisted(() => [] as Flight[]);
const dialFlights = vi.hoisted(() => [] as Flight[]);
vi.mock("motion/react", async original => ({
  ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: Clock, target: number, options: { duration: number }) => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const flight = { value, stop: vi.fn(), finish: () => { value.set(target); resolve(); } };
    (options.duration === .68 ? dialFlights : flights).push(flight);
    return Object.assign(promise, { stop: flight.stop });
  }),
}));
beforeEach(() => vi.stubGlobal("Image", class { src = ""; decode() { return Promise.resolve(); } }));
afterEach(() => { cleanup(); flights.length = 0; dialFlights.length = 0; vi.unstubAllGlobals(); vi.clearAllMocks(); });
const entries = codexSamples.slice(0, 3);
const finish = async (flight: Flight) => { await act(async () => flight.finish()); };
const alpha = (panel: HTMLElement, part: string) => Number(panel.style.getPropertyValue(`--codex-${part}`));
async function mount(clock = 1) {
  const scene: SystemSceneMotion = { clock: motionValue(clock), exiting: false, skip: false };
  const onBack = vi.fn();
  const view = render(<CodexPanel entries={entries} sceneMotion={scene} onBack={onBack}/>);
  await act(async () => {});
  for (const flight of [...flights]) await finish(flight); // Decode the initial illustration.
  flights.length = 0;
  const panel = view.container.querySelector<HTMLElement>(".codex-panel")!;
  const buttons = within(screen.getByRole("navigation", { name: "生物条目" })).getAllByRole("button");
  const show = (next: Partial<SystemSceneMotion>) => view.rerender(<CodexPanel entries={entries} sceneMotion={{ ...scene, ...next }} onBack={onBack}/>);
  return { ...view, panel, buttons, scene, show };
}

describe("codex motion handoff", () => {
  it("turns the dial by direction, coalesces rapid requests, and leaves art in place", async () => {
    const { panel, buttons } = await mount();
    const art = panel.querySelector<HTMLImageElement>(".codex-observation__art img")!;
    const transform = art.style.transform;
    fireEvent.click(buttons[1]);
    expect(dialFlights).toHaveLength(1);
    act(() => dialFlights[0].value.set(.25));
    expect(parseFloat(panel.style.getPropertyValue("--codex-dial-angle"))).toBeGreaterThan(0);
    expect(Number(panel.style.getPropertyValue("--codex-dial-scale"))).toBeGreaterThan(1);
    expect(Number(panel.style.getPropertyValue("--codex-dial-presence"))).toBeLessThan(1);
    expect(art.style.transform).toBe(transform);
    fireEvent.click(buttons[2]);
    expect(dialFlights).toHaveLength(1);
    expect(dialFlights[0].stop).not.toHaveBeenCalled();
    await finish(dialFlights[0]);
    expect(panel.style.getPropertyValue("--codex-dial-angle")).toBe("90deg");
    fireEvent.click(buttons[1]);
    await finish(dialFlights.at(-1)!);
    expect(panel.style.getPropertyValue("--codex-dial-angle")).toBe("0deg");
    expect(panel.style.getPropertyValue("--codex-dial-scale")).toBe("1");
    expect(panel.style.getPropertyValue("--codex-dial-blur")).toBe("0px");
  });
  it("commits only the latest request after all old content is invisible, keeping the page and image nodes", async () => {
    const { panel, buttons } = await mount();
    const art = screen.getByRole("img", { name: `${entries[0].name}的观察草图` });
    const frames = Array.from(panel.querySelectorAll(".codex-drops__image"));
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);
    expect(buttons[2]).toHaveAttribute("aria-current", "true");
    expect(flights).toHaveLength(1);
    expect(flights[0].stop).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(entries[0].name);
    act(() => flights[0].value.set(.6));
    expect(alpha(panel, "title")).toBeGreaterThan(0);
    expect(alpha(panel, "structure")).toBe(1);
    expect(alpha(panel, "stage")).toBe(1);
    await finish(flights[0]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(entries[2].name);
    expect(panel.querySelector(".codex-record p")).toHaveTextContent(entries[2].note!.text);
    expect(alpha(panel, "art")).toBe(0);
    expect(alpha(panel, "record")).toBe(0);
    expect(panel.querySelector(".codex-observation__art img")).toBe(art);
    expect(Array.from(panel.querySelectorAll(".codex-drops__image"))).toEqual(frames);
    act(() => flights[1].value.set(.5));
    expect(alpha(panel, "title")).toBeGreaterThan(alpha(panel, "description"));
    expect(alpha(panel, "description")).toBeGreaterThan(alpha(panel, "record"));
    await finish(flights[1]);
    expect(panel).toHaveAttribute("data-codex-entry-phase", "ready");
    for (const part of ["art", "title", "description", "facts", "record", "drops"]) expect(alpha(panel, part)).toBe(1);
  });

  it("interrupts an incoming entry from its current opacity and resets only the hidden reader scroll", async () => {
    const { panel, buttons } = await mount();
    const list = panel.querySelector<HTMLElement>("nav")!, details = panel.querySelector<HTMLElement>(".codex-details")!;
    list.scrollTop = 90; details.scrollTop = 120;
    fireEvent.click(buttons[1]);
    expect(details.scrollTop).toBe(120);
    await finish(flights[0]);
    expect(details.scrollTop).toBe(0);
    expect(list.scrollTop).toBe(90);
    act(() => flights[1].value.set(.35));
    const current = alpha(panel, "title");
    fireEvent.click(buttons[2]);
    expect(flights[1].stop).toHaveBeenCalled();
    expect(alpha(panel, "title")).toBe(current);
    await finish(flights[1]); // A cancelled completion cannot commit or reveal.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(entries[1].name);
    await finish(flights[2]);
    await finish(flights[3]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(entries[2].name);
    expect(alpha(panel, "art")).toBe(1);
  });

  it("gives exit its own sequence, preserves live values on reversal, and reaches zero before unmount", async () => {
    const { panel, scene, show } = await mount(0);
    act(() => scene.clock.set(.45));
    const before = alpha(panel, "art");
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(1);
    show({ exiting: true });
    expect(alpha(panel, "art")).toBe(before);
    act(() => scene.clock.set(.225));
    expect(alpha(panel, "art")).toBeLessThan(before);
    const reversing = alpha(panel, "art");
    show({ exiting: false });
    expect(alpha(panel, "art")).toBe(reversing);
    act(() => scene.clock.set(1));
    expect(alpha(panel, "art")).toBe(1);
    show({ exiting: true });
    act(() => scene.clock.set(.5));
    expect(alpha(panel, "title")).toBeLessThan(alpha(panel, "art"));
    act(() => scene.clock.set(0));
    for (const part of ["structure", "index", "stage", "art", "title", "description", "facts", "record", "drops", "footer"]) expect(alpha(panel, part)).toBe(0);
  });

  it("cancels pending content when leaving and resumes smoothly if the user returns", async () => {
    const { panel, buttons, scene, show } = await mount();
    fireEvent.click(buttons[1]);
    act(() => flights[0].value.set(.4));
    const current = alpha(panel, "title");
    show({ exiting: true });
    expect(alpha(panel, "title")).toBe(current);
    expect(flights[0].stop).toHaveBeenCalled();
    await finish(flights[0]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(entries[0].name);
    act(() => scene.clock.set(.7));
    show({ exiting: false });
    act(() => scene.clock.set(1));
    await finish(flights[1]);
    expect(alpha(panel, "art")).toBe(1);
    expect(buttons[0]).toHaveAttribute("aria-current", "true");
  });

  it("settles reduced motion immediately and ignores completions after unmount", async () => {
    const { panel, buttons, show, unmount, container } = await mount();
    fireEvent.click(buttons[1]);
    const old = flights[0];
    show({ skip: true });
    expect(old.stop).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(entries[1].name);
    expect(alpha(panel, "art")).toBe(1);
    expect(panel).toHaveAttribute("data-codex-entry-phase", "ready");
    fireEvent.click(buttons[2]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(entries[2].name);
    unmount(); await finish(old);
    expect(container.childElementCount).toBe(0);
  });
});
