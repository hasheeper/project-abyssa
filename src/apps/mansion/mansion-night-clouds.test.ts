import { afterEach, expect, it, vi } from "vitest";
import { mansionNightCloudRaster, paintMansionNightClouds } from "./mansion-night-clouds";

afterEach(() => vi.restoreAllMocks());

it("keeps transparent gaps and two-dimensional cloud depth instead of continuous horizontal bands", () => {
  const {data,width,height} = mansionNightCloudRaster();
  let visible = 0, longestRun = 0, fullestRow = 0, visibleRows = 0, maxAlpha = 0;
  const levels = new Set<number>();
  for (let y = 0; y < height; y++) {
    let run = 0, count = 0;
    for (let x = 0; x < width; x++) {
      const alpha = data[(y*width+x)*4+3];
      levels.add(alpha); maxAlpha = Math.max(maxAlpha,alpha);
      if (alpha > 6) { visible++; count++; longestRun = Math.max(longestRun,++run); }
      else run = 0;
    }
    fullestRow = Math.max(fullestRow,count);
    if (count) visibleRows++;
  }
  expect(visible/(width*height)).toBeGreaterThan(.05);
  expect(visible/(width*height)).toBeLessThan(.25);
  expect(longestRun/width).toBeLessThan(.32);
  expect(fullestRow/width).toBeLessThan(.6);
  expect(visibleRows/height).toBeGreaterThan(.5);
  expect(maxAlpha).toBeGreaterThan(32);
  expect(maxAlpha).toBeLessThanOrEqual(64);
  expect(levels.size).toBeGreaterThan(32);
  for (let x = 0; x < width; x++) expect(data[((height-1)*width+x)*4+3]).toBe(0);
});

it("reuses fixed CPU pixels rather than regenerating noise or retaining a live canvas", () => {
  const first = mansionNightCloudRaster(), second = mansionNightCloudRaster();
  expect(second).toBe(first);
  expect(first.data).toBeInstanceOf(Uint8ClampedArray);
  expect(first.width*first.height).toBeLessThan(400_000);
});

it("releases the detached work surface if a cloud context cannot be created", () => {
  const surface = document.createElement("canvas");
  vi.spyOn(document,"createElement").mockReturnValue(surface);
  vi.spyOn(surface,"getContext").mockReturnValue(null);
  const drawImage = vi.fn();
  expect(() => paintMansionNightClouds({drawImage} as unknown as CanvasRenderingContext2D)).toThrow("mansion cloud context unavailable");
  expect(surface.width).toBe(0);
  expect(surface.height).toBe(0);
  expect(drawImage).not.toHaveBeenCalled();
});
