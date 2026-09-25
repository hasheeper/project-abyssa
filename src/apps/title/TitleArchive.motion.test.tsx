import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TitleArchive } from "./TitleArchive";
import type { useTitleArchive } from "./useTitleArchive";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { slotTiming } from "../../game-client/save-slots-motion";

type Clock = { get(): number; set(value: number): void };
type Flight = { value: Clock; target: number; duration: number; stop: ReturnType<typeof vi.fn>; finish(): void };
const flights = vi.hoisted(() => [] as Flight[]);
vi.mock("motion/react", async original => ({
  ...await original<typeof import("motion/react")>(),
  animate: vi.fn((value: Clock, target: number, options: { duration: number }) => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const flight = { value, target, duration: options.duration, stop: vi.fn(), finish: () => { value.set(target); resolve(); } };
    flights.push(flight); return Object.assign(promise, { stop: flight.stop });
  }),
}));
vi.mock("../../game-client/useSaveSlots", () => ({ useSaveSlots: () => ({ index: null }) }));
afterEach(() => { cleanup(); flights.length = 0; vi.clearAllMocks(); });
type Archive = ReturnType<typeof useTitleArchive>;
function controller(overrides: Partial<Archive> = {}): Archive {
  return { saves: [{ saveId: "old-record", status: "unavailable", error: { code: "not-found", path: "save", message: "missing" } }],
    busy: false, operationBusy: false, setInteractionBusy: vi.fn(), removeFromList: vi.fn(), message: "", listState: "ready", open: true, setOpen: vi.fn(), pendingNewGame: null,
    archivedIds: new Set(), showArchived: false, setShowArchived: vi.fn(), cleanup: vi.fn(), restore: vi.fn(), choose: vi.fn(),
    continueGame: vi.fn(), newGame: vi.fn(), importGame: vi.fn(), continueSave: vi.fn(), exportGame: vi.fn(), refresh: vi.fn(), ...overrides };
}
const finish = async (flight: Flight) => { await act(async () => flight.finish()); };
const rail = () => document.querySelector<HTMLElement>(".save-slots__rail")!;
const body = () => document.querySelector<HTMLElement>(".save-slots__body")!;

it("waits on the open rails and resumes the same clock when data arrives, without a reset or jump", async () => {
  const archive = controller({ saves: [], listState: "loading", busy: true });
  const view = render(<TitleArchive archive={archive} onPresentChange={vi.fn()} />);
  expect(flights[0].target).toBe(slotTiming.railHoldMs / slotTiming.enterMs);
  act(() => flights[0].value.set(.15));
  const node = rail(), pose = node.style.getPropertyValue("--slot-rail-scale");
  view.rerender(<TitleArchive archive={controller()} onPresentChange={vi.fn()} />);
  expect(rail()).toBe(node);
  expect(node.style.getPropertyValue("--slot-rail-scale")).toBe(pose);
  expect(flights[0].stop).toHaveBeenCalled();
  expect(flights.at(-1)!.value.get()).toBe(.15);
  expect(body().style.opacity).toBe("0");
  await finish(flights.at(-1)!);
  expect(body().style.opacity).toBe("1");
  expect(rail().style.getPropertyValue("--slot-rail-scale")).toBe("1");
  expect(document.querySelector(".title-archive__interaction")).not.toHaveAttribute("inert");
});

it("retires records before the rails and removes the view only after the real exit", async () => {
  const archive = controller(), onPresent = vi.fn();
  const view = render(<TitleArchive archive={archive} onPresentChange={onPresent} />);
  await finish(flights[0]);
  view.rerender(<TitleArchive archive={{ ...archive, open: false }} onPresentChange={onPresent} />);
  const exit = flights.at(-1)!;
  expect(exit.duration).toBe(slotTiming.exitMs / 1000);
  act(() => exit.value.set(.7));
  expect(body().style.opacity).toBe("0");
  expect(rail().style.getPropertyValue("--slot-rail-scale")).toBe("1");
  expect(document.querySelector(".title-archive__interaction")).toHaveAttribute("inert");
  expect(onPresent).not.toHaveBeenCalledWith(false);
  await finish(exit);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onPresent).toHaveBeenLastCalledWith(false);
});

it("reverses an interrupted exit from its live pose and settles a live reduced-motion change", async () => {
  const archive = controller();
  const renderScene = (open: boolean, reduced = false) => <UiMotionProvider preference={reduced ? "reduced" : "system"}>
    <TitleArchive archive={{ ...archive, open }} onPresentChange={vi.fn()} />
  </UiMotionProvider>;
  const view = render(renderScene(true)); await finish(flights[0]);
  view.rerender(renderScene(false));
  const exit = flights.at(-1)!;
  act(() => exit.value.set(.65));
  const pose = [body().style.opacity, body().style.translate, rail().style.getPropertyValue("--slot-rail-scale")];
  view.rerender(renderScene(true));
  expect(exit.stop).toHaveBeenCalled();
  expect([body().style.opacity, body().style.translate, rail().style.getPropertyValue("--slot-rail-scale")]).toEqual(pose);
  view.rerender(renderScene(true, true));
  expect(body().style.opacity).toBe("1");
  expect(rail().style.getPropertyValue("--slot-rail-scale")).toBe("1");
  await finish(flights.at(-1)!);
  await finish(exit); // A stopped promise must not remove the reopened view.
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("defers the empty-directory new-game handoff until the archive has completely exited", async () => {
  const archive = controller({ saves: [] }), onStart = vi.fn();
  const view = render(<TitleArchive archive={archive} onNewGame={onStart} onPresentChange={vi.fn()} />);
  await finish(flights[0]);
  fireEvent.click(screen.getByRole("button", { name: "新的开始" }));
  expect(archive.setOpen).toHaveBeenCalledWith(false);
  expect(onStart).not.toHaveBeenCalled();
  view.rerender(<TitleArchive archive={{ ...archive, open: false }} onNewGame={onStart} onPresentChange={vi.fn()} />);
  await finish(flights.at(-1)!);
  expect(onStart).toHaveBeenCalledOnce();
  expect(archive.newGame).not.toHaveBeenCalled();
});
