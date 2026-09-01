import { describe, expect, it } from "vitest";
import { EMOTES } from "../../shared/ui/patterns/emotes";
import { ROSTER } from "./characters";
import {
  buildDefaults,
  buildEmoteDefaults,
  formatCalibrationTs,
  formatEmotesTs,
  formatJson,
  formatStageCss,
  getAdjust,
  hasAdjust,
  isDirty,
  num,
  parseEmotes,
  parseSnapshot,
  setAdjust
} from "./params";

describe("sprite studio parameters", () => {
  it("builds independent defaults for the complete roster", () => {
    const first = buildDefaults();
    const second = buildDefaults();

    expect(Object.keys(first)).toEqual(ROSTER.map(({ id }) => id));
    first.abyssa.stage.h = 120;
    expect(second.abyssa.stage.h).toBe(100);
    expect(isDirty("abyssa", first.abyssa, second)).toBe(true);
  });

  it("formats floating point values without accumulated zeroes", () => {
    expect(num(0.9950000000000001)).toBe("0.995");
    expect(num(-0)).toBe("0");
    expect(num(0.01234, 4)).toBe("0.0123");
  });

  it("keeps emote adjustments sparse and does not mutate the previous table", () => {
    const original = {};
    const added = setAdjust(original, "abyssa", "anger", { x: 2, y: 0, size: -1 });

    expect(original).toEqual({});
    expect(getAdjust(added, "abyssa", "anger")).toEqual({ x: 2, y: 0, size: -1 });
    expect(hasAdjust(added, "abyssa", "anger")).toBe(true);

    const cleared = setAdjust(added, "abyssa", "anger", { x: 0, y: 0, size: 0 });
    expect(cleared).toEqual({});
    expect(added).not.toEqual({});
  });

  it("round-trips the combined character and emote snapshot", () => {
    const params = buildDefaults();
    params.abyssa.cal = { scale: 1.005, x: 0.0123, y: -0.0045 };
    params.abyssa.stage = { h: 108.5, x: 2.5, y: -1.5 };
    const emotes = buildEmoteDefaults();
    const emoteId = EMOTES[0].id;
    emotes.base[emoteId] = { x: 4.5, y: -20, size: 32.5 };
    emotes.adjust = setAdjust(emotes.adjust, "abyssa", emoteId, { x: 1, y: -2, size: 0.5 });

    const snapshot = formatJson(params, emotes);

    expect(parseSnapshot(snapshot, buildDefaults())).toEqual(params);
    expect(parseEmotes(snapshot, buildEmoteDefaults())).toEqual(emotes);
  });

  it("falls back field-by-field when imported values are invalid", () => {
    const defaults = buildDefaults();
    const parsed = parseSnapshot(JSON.stringify({
      characters: {
        abyssa: {
          cal: { scale: "large", x: 0.02 },
          stage: { h: null, x: 3 }
        },
        unknown: { cal: { scale: 99 } }
      }
    }), defaults);

    expect(parsed.abyssa.cal.scale).toBe(defaults.abyssa.cal.scale);
    expect(parsed.abyssa.cal.x).toBe(0.02);
    expect(parsed.abyssa.stage.h).toBe(defaults.abyssa.stage.h);
    expect(parsed.abyssa.stage.x).toBe(3);
    expect(parsed).not.toHaveProperty("unknown");
  });

  it("emits the source formats expected by calibration, RP and emote files", () => {
    const params = buildDefaults();
    params.abyssa.cal = { scale: 1.01, x: 0.002, y: -0.003 };
    params.abyssa.stage = { h: 105, x: 1.5, y: -2 };
    const emotes = buildEmoteDefaults();
    const emoteId = EMOTES[0].id;
    emotes.adjust = setAdjust(emotes.adjust, "abyssa", emoteId, { x: 1, y: 0, size: 0 });

    const calibration = formatCalibrationTs(params);
    const stage = formatStageCss(params);
    const emote = formatEmotesTs(emotes);

    expect(calibration).toContain("export const CHARACTER_CALIBRATION");
    expect(calibration).toContain("scale: 1.01,");
    expect(stage).toContain('[data-character="abyssa"]');
    expect(stage).toContain("--abyssa-rp-doll-h: 105%; --abyssa-rp-doll-x: 1.5%; --abyssa-rp-doll-y: -2%;");
    expect(emote).toContain("export const EMOTE_PLACEMENT");
    expect(emote).toContain("export const EMOTE_ADJUST");
    expect(emote).toContain("abyssa:");
  });
});
