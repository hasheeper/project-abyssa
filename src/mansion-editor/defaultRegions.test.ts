import { describe, expect, it } from "vitest";
import {
  DEFAULT_MANSION_RECTANGLES,
  DEFAULT_MANSION_REGIONS
} from "./defaultRegions";

describe("mansion editor v8 defaults", () => {
  it("keeps every source key unique", () => {
    const ids = [
      ...DEFAULT_MANSION_RECTANGLES.map((item) => item.id),
      ...DEFAULT_MANSION_REGIONS.map((item) => item.id)
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the key rooms named by the v8 layout", () => {
    const ids = new Set([
      ...DEFAULT_MANSION_RECTANGLES.map((item) => item.id),
      ...DEFAULT_MANSION_REGIONS.map((item) => item.id)
    ]);
    for (const requiredId of [
      "abyssa",
      "kitchen",
      "library",
      "towerTop",
      "greenhouse",
      "gate"
    ]) {
      expect(ids.has(requiredId)).toBe(true);
    }
  });

  it("keeps rectangles inside the normalized canvas", () => {
    for (const { rect } of DEFAULT_MANSION_RECTANGLES) {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1.000001);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1.000001);
    }
  });

  it("keeps polygon vertices inside the normalized canvas", () => {
    for (const region of DEFAULT_MANSION_REGIONS) {
      expect(region.points.length).toBeGreaterThanOrEqual(3);
      for (const regionPoint of region.points) {
        expect(regionPoint.x).toBeGreaterThanOrEqual(0);
        expect(regionPoint.x).toBeLessThanOrEqual(1);
        expect(regionPoint.y).toBeGreaterThanOrEqual(0);
        expect(regionPoint.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("uses shared top and bottom lines for rooms on the same floor", () => {
    const byId = new Map(DEFAULT_MANSION_RECTANGLES.map((item) => [item.id, item]));
    const floorGroups = [
      ["bath", "lounge", "abyssa"],
      ["hall", "kitchen", "dining", "salon", "foyer"],
      ["workshop", "storage", "laundry", "maid", "cellar"],
      ["library", "array", "seal"],
      ["eustice", "norma"],
      ["elora", "kororo"]
    ];

    for (const ids of floorGroups) {
      const rooms = ids.map((id) => byId.get(id)!);
      const tops = new Set(rooms.map((room) => room.rect.y));
      const bottoms = new Set(rooms.map((room) =>
        Number((room.rect.y + room.rect.height).toFixed(6))
      ));
      expect(tops.size, `${ids.join(", ")} top edges`).toBe(1);
      expect(bottoms.size, `${ids.join(", ")} bottom edges`).toBe(1);
    }
  });
});
