import { useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { animate } from "motion/react";
import { loadImage } from "../../shared/loading/images";
import type { CharacterProfile } from "../../shared/ui/patterns/CharacterStatusScreen";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { useCharacterChange } from "./useCharacterChange";

vi.mock("../../shared/loading/images", () => ({ loadImage: vi.fn() }));
vi.mock("motion/react", async importOriginal => {
  const original = await importOriginal<typeof import("motion/react")>();
  return { ...original, animate: vi.fn((node: HTMLElement, values: Record<string, string | number>, options: { duration: number; delay?: number }) => {
    let timer: ReturnType<typeof setTimeout>;
    const promise = new Promise<void>(resolve => {
      timer = setTimeout(() => { Object.assign(node.style, values); resolve(); }, (options.duration + (options.delay ?? 0)) * 1000);
    });
    return Object.assign(promise, { stop: () => clearTimeout(timer) });
  }) };
});
const profiles: CharacterProfile[] = ["a", "b", "c"].map(id => ({ id, name: id, number: id, portraitUrl: `${id}.png`, status: { title: id } }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.mocked(loadImage).mockResolvedValue({} as HTMLImageElement);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
function Board({ id, label = "live" }: { id: string; label?: string }) {
  const root = useRef<HTMLElement>(null);
  const change = useCharacterChange(profiles.find(profile => profile.id === id), root);
  return <main ref={root} data-testid="board" data-shown={change.displayedId} data-phase={change.phase}>
    <div className="abyssa-character-screen__visual" data-testid="left">
      <div className="abyssa-character-screen__portrait"><img src={`${change.displayedId}.png`} alt={change.displayedId} /></div>
      <span data-testid="name">{change.displayedId}</span>
    </div>
    <div className="abyssa-character-screen__details" data-testid="right">
      <button role="tab">selected tab</button><div role="tabpanel">{change.displayedId}:{label}</div>
    </div>
    {profiles.map(profile => <button key={profile.id} data-character-id={profile.id}>select {profile.id}</button>)}
  </main>;
}
const board = () => screen.getByTestId("board");
const left = () => screen.getByTestId("left");
const right = () => screen.getByTestId("right");

it("does not animate mount or same-character live updates", () => {
  const view = render(<Board id="a" />);
  view.rerender(<Board id="a" label="updated" />);
  expect(board()).toHaveAttribute("data-phase", "ready");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("a:updated");
  expect(animate).not.toHaveBeenCalled();
  expect(loadImage).not.toHaveBeenCalled();
});
it("commits portrait, name and dossier together after preparation and a shared exit", async () => {
  let release!: () => void;
  vi.mocked(loadImage).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({} as HTMLImageElement); }));
  const view = render(<Board id="a" />);
  const tab = screen.getByRole("tab");
  view.rerender(<Board id="b" />);
  expect(board()).toHaveAttribute("data-phase", "preparing");
  expect(left().inert && right().inert).toBe(true);
  await advance(1000);
  expect(board()).toHaveAttribute("data-shown", "a");
  expect(animate).not.toHaveBeenCalled();
  await act(async () => release());
  await advance(79);
  expect(screen.getByTestId("name")).toHaveTextContent("a");
  await advance(1);
  expect(board()).toHaveAttribute("data-shown", "b");
  expect(screen.getByRole("img")).toHaveAttribute("src", "b.png");
  expect(screen.getByTestId("name")).toHaveTextContent("b");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("b:live");
  expect(screen.getByRole("tab")).toBe(tab);
  await advance(300);
  expect(board()).toHaveAttribute("data-phase", "ready");
  expect(left().inert || right().inert).toBe(false);
  const calls = vi.mocked(animate).mock.calls;
  expect(calls.slice(-2).map(call => (call[2] as { delay: number }).delay)).toEqual([0, .04]);
  expect(left().style.translate).toBe("");
  expect(right().style.opacity).toBe("");
});
it("latest request wins without replaying a stale image completion", async () => {
  let release!: () => void;
  vi.mocked(loadImage).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({} as HTMLImageElement); }));
  const view = render(<Board id="a" />);
  view.rerender(<Board id="b" />);
  view.rerender(<Board id="c" />);
  await advance(80);
  await advance(300);
  await act(async () => release());
  expect(board()).toHaveAttribute("data-shown", "c");
  expect(board()).toHaveAttribute("data-phase", "ready");
});
it("returning to the visible character during preload cancels the pending change completely", async () => {
  let release!: () => void;
  vi.mocked(loadImage).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({} as HTMLImageElement); }));
  const view = render(<Board id="a" />);
  view.rerender(<Board id="b" />);
  view.rerender(<Board id="a" />);
  expect(board()).toHaveAttribute("data-phase", "ready");
  expect(left().inert || right().inert).toBe(false);
  await act(async () => release());
  expect(board()).toHaveAttribute("data-shown", "a");
  expect(animate).not.toHaveBeenCalled();
});
it("recovers the current dossier if the next image is slow during an interrupted entry", async () => {
  const view = render(<Board id="a" />);
  view.rerender(<Board id="b" />);
  await advance(80);
  expect(board()).toHaveAttribute("data-shown", "b");
  vi.mocked(loadImage).mockImplementationOnce(() => new Promise(() => {}));
  view.rerender(<Board id="c" />);
  await advance(150);
  expect(board()).toHaveAttribute("data-phase", "preparing");
  expect(board()).toHaveAttribute("data-shown", "b");
  expect(left().style.opacity).toBe("1");
  expect(right().style.opacity).toBe("1");
});
it("keeps selector focus and moves outgoing keyboard focus to the requested selector", async () => {
  const view = render(<Board id="a" />);
  screen.getByRole("tab").focus();
  view.rerender(<Board id="b" />);
  expect(screen.getByRole("button", { name: "select b" })).toHaveFocus();
  await advance(80); await advance(300);
  expect(screen.getByRole("button", { name: "select b" })).toHaveFocus();
});
it("handles image failure, reduction, hidden pages and unmount without leftover work", async () => {
  vi.mocked(loadImage).mockRejectedValueOnce(new Error("missing"));
  const view = render(<UiMotionProvider preference="system"><Board id="a" /></UiMotionProvider>);
  view.rerender(<UiMotionProvider preference="system"><Board id="b" /></UiMotionProvider>);
  await advance(80); await advance(300);
  expect(board()).toHaveAttribute("data-shown", "b");
  view.rerender(<UiMotionProvider preference="reduced"><Board id="c" /></UiMotionProvider>);
  expect(board()).toHaveAttribute("data-shown", "c");
  expect(board()).toHaveAttribute("data-phase", "ready");
  view.rerender(<UiMotionProvider preference="system"><Board id="b" /></UiMotionProvider>);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(board()).toHaveAttribute("data-shown", "b");
  expect(board()).toHaveAttribute("data-phase", "ready");
  expect(left().inert || right().inert).toBe(false);
  view.unmount();
  await advance(1000);
  expect(vi.getTimerCount()).toBe(0);
});
