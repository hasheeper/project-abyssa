import { describe, expect, it } from "vitest";
import { randomRollDuration } from "./timing";

describe("roll presentation timing", () => {
  it("maps the random source to the supported duration window", () => {
    expect(randomRollDuration(() => 0)).toBe(0.85);
    expect(randomRollDuration(() => 1)).toBe(1.3);
    expect(randomRollDuration(() => 0.5)).toBeCloseTo(1.075);
  });
});
