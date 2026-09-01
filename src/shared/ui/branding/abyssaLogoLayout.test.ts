import { describe, expect, it } from "vitest";
import {
  DEFAULT_ABYSSA_LOGO_LAYOUT,
  cloneAbyssaLogoLayout,
  formatAbyssaLogoLayoutJson,
  parseAbyssaLogoLayout
} from "./abyssaLogoLayout";

describe("Abyssa logo layout", () => {
  it("ships the approved composition as the default layout", () => {
    expect(DEFAULT_ABYSSA_LOGO_LAYOUT).toEqual({
      stamp: { x: 0, y: 0, scale: 1.16, rotate: 0, opacity: 0.37 },
      sideOrnaments: { x: 0, y: -4, scale: 1, rotate: 0, opacity: 1 },
      titleTop: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
      titleMiddle: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
      titleBottom: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
      questionMark: { x: 24, y: 21, scale: 1, rotate: 0, opacity: 1 },
      divider: { x: 0, y: 13, scale: 0.75, rotate: 0, opacity: 1 },
      wordmark: { x: 0, y: -3, scale: 1.03, rotate: 0, opacity: 1 }
    });
  });

  it("round-trips every part through the JSON snapshot", () => {
    const layout = cloneAbyssaLogoLayout();
    layout.questionMark = { x: 14, y: -8, scale: 1.12, rotate: 6, opacity: 0.82 };

    expect(parseAbyssaLogoLayout(formatAbyssaLogoLayoutJson(layout))).toEqual(layout);
  });

  it("fills missing and invalid fields from defaults", () => {
    const layout = parseAbyssaLogoLayout(JSON.stringify({
      version: 1,
      layout: {
        divider: { x: 24, y: "invalid", scale: null, opacity: 0.5 },
        unknownFuturePart: { x: 999 }
      }
    }));

    expect(layout.divider).toEqual({
      ...DEFAULT_ABYSSA_LOGO_LAYOUT.divider,
      x: 24,
      opacity: 0.5
    });
    expect(layout.titleTop).toEqual(DEFAULT_ABYSSA_LOGO_LAYOUT.titleTop);
    expect("unknownFuturePart" in layout).toBe(false);
  });

  it("clones nested transform objects", () => {
    const clone = cloneAbyssaLogoLayout();
    clone.titleTop.x = 100;
    expect(DEFAULT_ABYSSA_LOGO_LAYOUT.titleTop.x).toBe(0);
  });
});
