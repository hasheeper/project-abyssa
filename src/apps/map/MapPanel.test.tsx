import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { motion } from "motion/react";
import { MapPanel } from "./MapPanel";

const state = vi.hoisted(() => ({ reduced: false, present: true }));
vi.mock("../../shared/ui/motion/UiMotionProvider", () => ({ useUiMotion: () => ({ reduced: state.reduced }) }));
vi.mock("motion/react", () => ({
  motion: { div: vi.fn(({ children }: { children: ReactNode }) => <div>{children}</div>) },
  useIsPresent: () => state.present,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); state.reduced = false; state.present = true; });

// Pins the animation owner's contract; browser checks cover actual interpolation.
const cases = [
  { kind: "quest", side: "left", x: -40, y: 0, duration: .78 },
  { kind: "quest", side: "right", x: 40, y: 0, duration: .78 },
  { kind: "team", x: 0, y: 28, duration: .56 },
  { kind: "loadout", x: 0, y: 28, duration: .56 },
] as const;
const lastProps = () => vi.mocked(motion.div).mock.calls.at(-1)![0];

describe("MapPanel sole arrival owner", () => {
  it.each(cases)("preserves $kind $side entrance and exit parameters", entry => {
    render(<MapPanel {...entry}>面板</MapPanel>);
    const props = lastProps();
    expect(props.initial).toEqual({ opacity: 0, x: entry.x, y: entry.y });
    expect(props.animate).toEqual({ opacity: 1, x: 0, y: 0 });
    expect(props.transition).toEqual({ duration: entry.duration, ease: [.65, 0, .35, 1] });
    expect(props.exit).toEqual({ opacity: 0, x: entry.x / 3, y: entry.y / 3, transition: { duration: .16, ease: "easeOut" } });
  });

  it.each(cases)("keeps $kind $side fully visible and stationary when reduced", entry => {
    state.reduced = true;
    render(<MapPanel {...entry}>面板</MapPanel>);
    expect(lastProps().initial).toEqual({ opacity: 1, x: 0, y: 0 });
    expect(lastProps().transition).toMatchObject({ duration: 0 });
    expect(lastProps().exit).toEqual({ opacity: 0, x: 0, y: 0, transition: { duration: 0, ease: "easeOut" } });
  });

  it("blocks interaction throughout the outgoing panel's presence", () => {
    state.present = false;
    render(<MapPanel kind="quest" side="left">面板</MapPanel>);
    expect(lastProps()).toMatchObject({ inert: true, "aria-hidden": true, "data-exiting": true });
  });
});
