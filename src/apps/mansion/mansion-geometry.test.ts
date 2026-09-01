import { describe, expect, it } from "vitest";
import { STAGE_CANVAS_HEIGHT, STAGE_CANVAS_WIDTH } from "../../shared/stage";
import type { SceneRegion } from "./mansion-geometry";
import {
  INITIAL_PAN,
  MIN_PAN,
  WORLD_DISPLAY_HEIGHT,
  WORLD_DISPLAY_WIDTH,
  clampPan,
  cleanRegionLabel,
  markerSlot,
  regionAnchor,
  regionBounds,
  regionLabelY,
  roomFocusTransform,
  roomPreviewImageStyle
} from "./mansion-geometry";

const rectangle: SceneRegion = {
  id: "room",
  label: "【测试】房间",
  kind: "room",
  shape: "rectangle",
  rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
};

const polygon: SceneRegion = {
  id: "tower",
  label: "塔楼",
  kind: "building",
  shape: "polygon",
  points: [
    { x: 0.2, y: 0.1 },
    { x: 0.4, y: 0.2 },
    { x: 0.3, y: 0.5 }
  ]
};

describe("mansion geometry", () => {
  it("converts rectangle and polygon regions into world-space bounds", () => {
    expect(regionBounds(rectangle)).toEqual({
      left: 516.2,
      top: 382,
      right: 2064.8,
      bottom: 1146.0000000000002
    });
    expect(regionBounds(polygon)).toEqual({
      left: 1032.4,
      top: 191,
      right: 2064.8,
      bottom: 955
    });
  });

  it("clamps panning to the visible horizontal world range", () => {
    expect(WORLD_DISPLAY_HEIGHT).toBe(STAGE_CANVAS_HEIGHT);
    expect(WORLD_DISPLAY_WIDTH).toBeGreaterThan(STAGE_CANVAS_WIDTH);
    expect(clampPan(100)).toBe(0);
    expect(clampPan(MIN_PAN - 100)).toBe(MIN_PAN);
    expect(clampPan(-200)).toBe(-200);
    expect(INITIAL_PAN).toBeGreaterThanOrEqual(MIN_PAN);
    expect(INITIAL_PAN).toBeLessThanOrEqual(0);
  });

  it("keeps focused rooms inside the zoomed stage for either drawer side", () => {
    const leftDrawer = roomFocusTransform(rectangle, "left");
    const rightDrawer = roomFocusTransform(rectangle, "right");

    for (const camera of [leftDrawer, rightDrawer]) {
      expect(camera.zoom).toBe(1.45);
      expect(camera.x).toBeLessThanOrEqual(0);
      expect(camera.x).toBeGreaterThanOrEqual(
        STAGE_CANVAS_WIDTH - WORLD_DISPLAY_WIDTH * camera.zoom
      );
      expect(camera.y).toBeLessThanOrEqual(0);
      expect(camera.y).toBeGreaterThanOrEqual(
        STAGE_CANVAS_HEIGHT - WORLD_DISPLAY_HEIGHT * camera.zoom
      );
    }
    expect(leftDrawer.x).toBeGreaterThan(rightDrawer.x);
  });

  it("centers the selected room in its preview crop", () => {
    const bounds = regionBounds(rectangle);
    const style = roomPreviewImageStyle(rectangle);
    const scale = style.width / 5162;
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;

    expect(style.height / 1910).toBeCloseTo(scale);
    expect(style.left + centerX * scale).toBeCloseTo(74);
    expect(style.top + centerY * scale).toBeCloseTo(47);
  });

  it("separates bottom labels, residents and right-to-left marker slots", () => {
    const bounds = regionBounds(rectangle);
    const resident = regionAnchor(rectangle, "bottom-center");
    const firstMarker = markerSlot(rectangle, 0, 62);
    const secondMarker = markerSlot(rectangle, 1, 62);

    expect(resident.x).toBeCloseTo((bounds.left + bounds.right) / 2);
    expect(resident.y).toBeLessThan(bounds.bottom);
    expect(regionLabelY(rectangle)).toBeCloseTo(bounds.bottom - 16);
    expect(firstMarker.y).toBe(secondMarker.y);
    expect(firstMarker.x - secondMarker.x).toBe(70);
    expect(cleanRegionLabel(rectangle.label)).toBe("房间");
  });
});
