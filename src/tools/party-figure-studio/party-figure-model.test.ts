import { describe, expect, it } from "vitest";
import {
  PARTY_FIGURE_IDS,
  clonePartyFigureCalibrations,
  parsePartyFigureCalibrationJson,
  parsePartyFigureCalibrationTypeScript,
  stringifyPartyFigureCalibrationJson,
  stringifyPartyFigureCalibrationTypeScript
} from "../../content/characters/partyFigureCalibration";
import {
  clonePartyFigureMap,
  getDirtyPartyFigureIds,
  makeInitialPartyFigureLineup,
  normalizePartyFigureCalibration,
  PARTY_FIGURE_PARTY_CANVAS,
  PARTY_FIGURE_PARTY_SLOTS,
  PARTY_FIGURE_STORAGE_KEY,
  partyFigurePartySlotMetrics,
  togglePartyFigure,
  updatePartyFigureCalibration
} from "./party-figure-model";

describe("party figure studio model", () => {
  it("uses the storage version for the current authored baseline", () => {
    expect(PARTY_FIGURE_STORAGE_KEY).toBe("abyssa.party-figure-studio.v3");
  });

  it("uses the complete ten-person shared roster and a five-person comparison lineup", () => {
    expect(PARTY_FIGURE_IDS).toHaveLength(10);
    expect(PARTY_FIGURE_IDS).toContain("kael");
    expect(PARTY_FIGURE_IDS).not.toContain("tibby");
    expect(makeInitialPartyFigureLineup()).toEqual([
      "abyssa",
      "alvitr",
      "elora",
      "eustice",
      "kael"
    ]);
  });

  it("matches the compact 880px team canvas and its five layered slots", () => {
    expect(PARTY_FIGURE_PARTY_CANVAS).toEqual({ width: 880, height: 350 });
    expect(PARTY_FIGURE_PARTY_SLOTS).toHaveLength(5);

    PARTY_FIGURE_PARTY_SLOTS.forEach((slot) => {
      expect(slot.height).toBeLessThanOrEqual(PARTY_FIGURE_PARTY_CANVAS.height);
    });

    const last = PARTY_FIGURE_PARTY_SLOTS.at(-1)!;
    expect(last.left + last.width).toBeLessThanOrEqual(PARTY_FIGURE_PARTY_CANVAS.width);
    expect(PARTY_FIGURE_PARTY_SLOTS).toEqual([
      { left: 20, width: 170, height: 285, zIndex: 3 },
      { left: 185, width: 170, height: 305, zIndex: 4 },
      { left: 350, width: 180, height: 320, zIndex: 5 },
      { left: 525, width: 170, height: 305, zIndex: 4 },
      { left: 690, width: 180, height: 330, zIndex: 4 }
    ]);

    const first = partyFigurePartySlotMetrics(285);
    expect(first.figureBottomPercent).toBeCloseTo(32 / 285 * 100);
    expect(first.figureHeightPercent).toBeCloseTo((285 - 32) / 285 * 100);
    expect(first.nameHeightPercent).toBeCloseTo(24 / 285 * 100);
  });

  it("clamps and snaps manual values to the shared control ranges", () => {
    expect(normalizePartyFigureCalibration({
      scale: 1.234,
      x: 4.26,
      y: -18,
      flipX: true
    })).toEqual({ scale: 1.23, x: 4.5, y: -15, flipX: true });
  });

  it("updates one figure without mutating the shared baseline", () => {
    const baseline = clonePartyFigureCalibrations();
    const before = clonePartyFigureMap(baseline);
    const next = updatePartyFigureCalibration(
      baseline,
      "abyssa",
      { scale: 1.1, x: 2, y: 3, flipX: true }
    );

    expect(next.abyssa).toEqual({ scale: 1.1, x: 2, y: 3, flipX: true });
    expect(baseline).toEqual(before);
    expect(getDirtyPartyFigureIds(next, baseline)).toEqual(new Set(["abyssa"]));
  });

  it("adds figures in order, removes them and refuses a sixth", () => {
    expect(togglePartyFigure(["abyssa", "alvitr"], "elora")).toEqual([
      "abyssa",
      "alvitr",
      "elora"
    ]);
    expect(togglePartyFigure(["abyssa", "alvitr"], "abyssa")).toEqual(["alvitr"]);
    const full = makeInitialPartyFigureLineup();
    expect(togglePartyFigure(full, "kororo")).toEqual(full);
  });

  it("keeps JSON and TypeScript exports deterministic and round-trippable", () => {
    const values = clonePartyFigureCalibrations();
    values.abyssa = { scale: 1.05, x: 2.5, y: -1, flipX: true };

    const json = stringifyPartyFigureCalibrationJson(values);
    const typescript = stringifyPartyFigureCalibrationTypeScript(values);

    expect(stringifyPartyFigureCalibrationJson(values)).toBe(json);
    expect(stringifyPartyFigureCalibrationTypeScript(values)).toBe(typescript);
    expect(parsePartyFigureCalibrationJson(json)).toEqual(values);
    expect(parsePartyFigureCalibrationTypeScript(typescript)).toEqual(values);
    expect(Object.keys(JSON.parse(json))).toEqual(PARTY_FIGURE_IDS);
  });
});
