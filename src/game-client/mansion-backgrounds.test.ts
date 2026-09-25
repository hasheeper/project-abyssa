import { expect, it } from "vitest";
import { DEFAULT_MANSION_RECTANGLES, DEFAULT_MANSION_REGIONS } from "../content/mansion/defaultRegions";
import { mansionBackgroundForLocation, mansionPreviewForLocation, mansionSceneBackground } from "./mansion-backgrounds";

it("has a distinct background for every mapped mansion location, reusing the existing shop art", () => {
  const ids = [...DEFAULT_MANSION_RECTANGLES, ...DEFAULT_MANSION_REGIONS].map(region => region.id);
  expect(ids).toHaveLength(31);
  const images = ids.map(id => mansionBackgroundForLocation(id));
  expect(images.every(Boolean)).toBe(true);
  expect(new Set(images).size).toBe(31);
  expect(mansionBackgroundForLocation("tibby")).toContain("shop-bg3");
  const previews = ids.map(id => mansionPreviewForLocation(id));
  expect(previews.every(Boolean)).toBe(true);
  expect(new Set(previews).size).toBe(31);
  expect(previews.every((url, i) => url !== images[i] && url?.includes("/previews/"))).toBe(true);
});

it("uses legacy common backdrops only for unknown or old locations", () => {
  expect(mansionSceneBackground("elora", 0)).toBe(mansionBackgroundForLocation("elora"));
  expect(mansionSceneBackground("elora", 3)).toBe(mansionBackgroundForLocation("elora"));
  expect(mansionSceneBackground("legacy.unmapped", 0)).not.toBe(mansionSceneBackground("legacy.unmapped", 3));
  expect(mansionBackgroundForLocation(undefined)).toBeUndefined();
  expect(mansionPreviewForLocation("legacy.unmapped")).toBeUndefined();
});
