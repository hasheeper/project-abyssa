import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { animate } from "motion/react";
import { loadImage } from "../../shared/loading/images";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { CharacterContentSwap } from "./CharacterContentSwap";

vi.mock("../../shared/loading/images", () => ({ loadImage: vi.fn() }));
vi.mock("motion/react", async importOriginal => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, animate: vi.fn((value, to, options) => {
    let timer: ReturnType<typeof setTimeout>;
    const promise = new Promise<void>(resolve => {
      timer = setTimeout(() => { value.set(to); resolve(); }, options.duration * 1000);
    });
    return Object.assign(promise, { stop: () => clearTimeout(timer) });
  }) };
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.mocked(loadImage).mockResolvedValue({} as HTMLImageElement);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
function Panel({ id, imageUrl, reduced = false, label = id }: { id: string; imageUrl?: string; reduced?: boolean; label?: string }) {
  return <UiMotionProvider preference={reduced ? "reduced" : "system"}>
    <div role="tabpanel" tabIndex={0}><CharacterContentSwap contentKey={id} imageUrl={imageUrl} className="swap">
      <Counter label={label} />
    </CharacterContentSwap></div>
  </UiMotionProvider>;
}
function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  return <button id="only-content" onClick={() => setCount(n => n + 1)}>{label}:{count}</button>;
}

it("does not animate first render or same-key live updates, preserving child state", () => {
  const view = render(<Panel id="a" />);
  fireEvent.click(screen.getByRole("button"));
  view.rerender(<Panel id="a" label="fresh" />);
  expect(screen.getByRole("button")).toHaveTextContent("fresh:1");
  expect(animate).not.toHaveBeenCalled();
});
it("keeps one inert outgoing tree, replaces it after exit and restores focus to the slot", async () => {
  const view = render(<Panel id="a" />);
  screen.getByRole("button").focus();
  view.rerender(<Panel id="b" />);
  expect(view.container.querySelector(".swap")).toHaveAttribute("inert");
  expect(view.container.querySelectorAll("#only-content")).toHaveLength(1);
  expect(screen.getByRole("button")).toHaveTextContent("a:0");
  await advance(80);
  expect(screen.getByRole("button")).toHaveTextContent("b:0");
  expect(screen.getByRole("tabpanel")).toHaveFocus();
  expect(view.container.querySelector(".swap")).not.toHaveAttribute("inert");
  await advance(220);
  expect(animate).toHaveBeenCalledTimes(3);
  // The mocked controller validates lifecycle; real DOM intermediate and final
  // styles are checked in ui-motion.spec.ts (no fake animation-frame renderer).
  const value = vi.mocked(animate).mock.calls[0][0] as unknown as { get(): number };
  expect(value.get()).toBe(1);
});
it("prepares images without blanking the old portrait and ignores stale completion", async () => {
  let release!: () => void;
  vi.mocked(loadImage).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({} as HTMLImageElement); }));
  const view = render(<Panel id="a" />);
  view.rerender(<Panel id="b" imageUrl="b.png" />);
  await advance(500);
  expect(animate).not.toHaveBeenCalled();
  expect(screen.getByRole("button")).toHaveTextContent("a:0");
  view.rerender(<Panel id="c" imageUrl="c.png" />);
  await advance(320);
  await act(async () => release());
  expect(screen.getByRole("button")).toHaveTextContent("c:0");
  expect(view.container.querySelectorAll("#only-content")).toHaveLength(1);
});
it("handles a failed preload, latest data during exit and a quick return to the current key", async () => {
  vi.mocked(loadImage).mockRejectedValueOnce(new Error("missing"));
  const view = render(<Panel id="a" />);
  view.rerender(<Panel id="b" imageUrl="missing.png" />);
  await advance(20);
  view.rerender(<Panel id="b" imageUrl="missing.png" label="latest" />);
  await advance(300);
  expect(screen.getByRole("button")).toHaveTextContent("latest:0");
  view.rerender(<Panel id="c" />);
  await advance(20);
  view.rerender(<Panel id="b" label="returned" />);
  await advance(250);
  expect(screen.getByRole("button")).toHaveTextContent("returned:0");
});
it("settles immediately when reduced/hidden, cancels pending work and cleans up on unmount", async () => {
  let release!: () => void;
  vi.mocked(loadImage).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({} as HTMLImageElement); }));
  const view = render(<Panel id="a" />);
  view.rerender(<Panel id="b" imageUrl="b.png" />);
  view.rerender(<Panel id="b" imageUrl="b.png" reduced />);
  expect(screen.getByRole("button")).toHaveTextContent("b:0");
  await act(async () => release());
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<Panel id="c" />);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByRole("button")).toHaveTextContent("c:0");
  view.unmount();
  await advance(1000);
  expect(vi.getTimerCount()).toBe(0);
});
