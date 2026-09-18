import { describe, expect, it } from "vitest";
import { manorWindowMotion, manorWindowTransition, motionTokens, surfaceTransition } from "./presets";

describe("shared UI motion parameter source", () => {
  it("retains the existing default surface and reduced durations", () => {
    expect(motionTokens.surface).toEqual({ enterMs: 220, exitMs: 160, distancePx: 8, reducedMs: 80 });
    expect(surfaceTransition(false).duration).toBe(.22);
    expect(surfaceTransition(false, true).duration).toBe(.16);
    expect(surfaceTransition(true).duration).toBe(.08);
  });

  it("reads manor parameters from the same JSON as the generated CSS", () => {
    expect(manorWindowMotion).toBe(motionTokens.manorWindow);
    expect(manorWindowMotion).toEqual({
      enterMs: 760, exitMs: 200, distancePx: 30, exitDistancePx: 8,
      fadeMs: 240, scrimMs: 180, ease: [.28, .08, .24, 1],
      bodyMs: 380, bodyDelayMs: 140, chromeMs: 360, chromeDelayMs: 100,
      contentDistancePx: 8, contentEase: [.22, .6, .24, 1],
    });
    expect(manorWindowTransition(false, false)).toEqual({ duration: .76, ease: [.28, .08, .24, 1], type: "tween" });
    expect(manorWindowTransition(false, true).duration).toBe(.2);
    expect(manorWindowTransition(true, false).duration).toBe(.08);
    expect(manorWindowTransition(true, true).duration).toBe(.08);
  });

  it("preserves the established board drop instead of imposing manor timing", () => {
    expect(motionTokens.pageBoard).toEqual({
      settleMs: 820, appearMs: 240, distancePx: 34,
      settleEase: [.32, 0, .18, 1], appearEase: [.3, 0, .5, 1],
    });
  });
});
