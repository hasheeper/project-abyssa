import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARTY_FIGURE_CALIBRATION,
  PARTY_FIGURE_IDS,
  assertPartyFigureCalibrationMap,
  clonePartyFigureCalibrations,
  defaultPartyFigureCalibrations,
  isPartyFigureCalibrationMap,
  parsePartyFigureCalibrationJson,
  parsePartyFigureCalibrationTypeScript,
  partyFigureCalibrations,
  stringifyPartyFigureCalibrationJson,
  stringifyPartyFigureCalibrationTypeScript,
  validatePartyFigureCalibrationMap
} from "./partyFigureCalibration";

describe("party figure calibration", () => {
  it("keeps the fixed ten-character roster", () => {
    expect(PARTY_FIGURE_IDS).toEqual([
      "abyssa",
      "alvitr",
      "elora",
      "eustice",
      "kael",
      "kororo",
      "lenore",
      "marietta",
      "norma",
      "vivienne"
    ]);
    expect(PARTY_FIGURE_IDS).not.toContain("tibby");
  });

  it("provides neutral fallbacks and the authored default baseline", () => {
    for (const id of PARTY_FIGURE_IDS) {
      expect(defaultPartyFigureCalibrations[id]).toEqual(DEFAULT_PARTY_FIGURE_CALIBRATION);
    }

    expect(partyFigureCalibrations).toEqual({
      abyssa: { scale: 0.98, x: 0, y: -2.5, flipX: false },
      alvitr: { scale: 1.11, x: 4, y: 0, flipX: true },
      elora: { scale: 1, x: 5.5, y: 0, flipX: true },
      eustice: { scale: 1, x: 0, y: 0, flipX: false },
      kael: { scale: 0.97, x: 0, y: 0, flipX: false },
      kororo: { scale: 1.03, x: 0, y: 0, flipX: true },
      lenore: { scale: 0.96, x: 0, y: 0, flipX: false },
      marietta: { scale: 0.96, x: 0, y: 0, flipX: false },
      norma: { scale: 0.92, x: -2.5, y: 0, flipX: false },
      vivienne: { scale: 1.02, x: 0, y: 0, flipX: false }
    });
  });

  it("returns a mutable deep clone without changing the shared values", () => {
    const clone = clonePartyFigureCalibrations();
    clone.alvitr.scale = 0.9;
    clone.elora.flipX = false;

    expect(partyFigureCalibrations.alvitr.scale).toBe(1.11);
    expect(partyFigureCalibrations.elora.flipX).toBe(true);
    expect(clone.alvitr).not.toBe(partyFigureCalibrations.alvitr);
  });

  it("validates exact ids, fields, finite values and shared limits", () => {
    expect(isPartyFigureCalibrationMap(partyFigureCalibrations)).toBe(true);
    expect(validatePartyFigureCalibrationMap(partyFigureCalibrations)).toMatchObject({ ok: true });

    const missing = clonePartyFigureCalibrations() as Partial<ReturnType<typeof clonePartyFigureCalibrations>>;
    delete missing.kael;
    expect(isPartyFigureCalibrationMap(missing)).toBe(false);

    const extra = { ...clonePartyFigureCalibrations(), tibby: DEFAULT_PARTY_FIGURE_CALIBRATION };
    expect(validatePartyFigureCalibrationMap(extra)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["unknown character id: tibby"])
    });

    const invalid = clonePartyFigureCalibrations();
    invalid.alvitr.scale = Number.NaN;
    invalid.elora.x = 16;
    Object.assign(invalid.kororo, { note: "not part of the contract" });
    expect(validatePartyFigureCalibrationMap(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "alvitr.scale must be a finite number",
        "elora.x must be between -15 and 15",
        "kororo.note is not supported"
      ])
    });
    expect(() => assertPartyFigureCalibrationMap(invalid)).toThrow(
      "Invalid party figure calibrations"
    );
  });

  it("round-trips deterministic JSON in the fixed roster order", () => {
    const json = stringifyPartyFigureCalibrationJson();
    expect(json.endsWith("\n")).toBe(true);
    expect(json.indexOf('"abyssa"')).toBeLessThan(json.indexOf('"vivienne"'));
    expect(stringifyPartyFigureCalibrationJson(parsePartyFigureCalibrationJson(json))).toBe(json);
  });

  it("round-trips the safe JSON-compatible TypeScript export", () => {
    const source = stringifyPartyFigureCalibrationTypeScript();
    expect(source).toMatch(/^export const partyFigureCalibrations = \{/);
    expect(source).toMatch(/\} as const;\n$/);
    expect(parsePartyFigureCalibrationTypeScript(source)).toEqual(
      clonePartyFigureCalibrations()
    );
    expect(() => parsePartyFigureCalibrationTypeScript("export const unrelated = {};"))
      .toThrow("must declare partyFigureCalibrations");
  });
});
