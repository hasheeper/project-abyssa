import type { MansionRectangle, MansionRegion } from "../../shared/domain/mansion/regions";
import { STAGE_CANVAS_HEIGHT, STAGE_CANVAS_WIDTH } from "../../shared/stage";
import { MANSION_WORLD_HEIGHT, MANSION_WORLD_WIDTH } from "./data";

export type SceneRegion =
  | ({ shape: "rectangle" } & MansionRectangle)
  | ({ shape: "polygon" } & MansionRegion);

export type DrawerSide = "left" | "right";

export interface Point {
  x: number;
  y: number;
}

/**
 * The mansion is a full-bleed horizontal world. It fills the fixed stage
 * vertically and pans horizontally; it deliberately does not use the framed
 * app interior dimensions from stage.css.
 */
export const WORLD_DISPLAY_HEIGHT = STAGE_CANVAS_HEIGHT;
export const WORLD_SCALE = WORLD_DISPLAY_HEIGHT / MANSION_WORLD_HEIGHT;
export const WORLD_DISPLAY_WIDTH = MANSION_WORLD_WIDTH * WORLD_SCALE;
export const MIN_PAN = STAGE_CANVAS_WIDTH - WORLD_DISPLAY_WIDTH;

export const PAN_STEP = Math.round(STAGE_CANVAS_WIDTH * 0.4);
export const PAN_KEY_STEP = Math.round(STAGE_CANVAS_WIDTH * 0.09);

const ROOM_FOCUS_ZOOM = 1.45;
const ROOM_FOCUS_CENTER_X = 590;
const ROOM_FOCUS_CENTER_Y = STAGE_CANVAS_HEIGHT / 2;
const ROOM_PREVIEW_WIDTH = 148;
const ROOM_PREVIEW_HEIGHT = 94;

export const CHARACTER_AVATAR = 100;
const CHARACTER_NAME_FS = 30;
const CHARACTER_BOTTOM_PAD = 26;
const CHARACTER_TOP_CLEARANCE = 6;

export const UNDERGROUND_TOP = 1350;
export const UNDERGROUND_BOTTOM = MANSION_WORLD_HEIGHT;
export const UNDERGROUND_LEFT = 0.270 * MANSION_WORLD_WIDTH - 110;
export const UNDERGROUND_RIGHT = 0.589 * MANSION_WORLD_WIDTH + 110;

const MARKER_SLOT_INSET = 18;
const MARKER_SLOT_GAP = 8;

export function clampPan(value: number) {
  return Math.max(MIN_PAN, Math.min(0, value));
}

/** Initial view points at the main building around 30% of the world width. */
export const INITIAL_PAN = clampPan(
  STAGE_CANVAS_WIDTH / 2 - 0.3 * WORLD_DISPLAY_WIDTH
);

export function cleanRegionLabel(label: string) {
  return label.replace(/【.*?】/g, "").trim();
}

export interface RegionBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function regionBounds(region: SceneRegion): RegionBounds {
  if (region.shape === "rectangle") {
    return {
      left: region.rect.x * MANSION_WORLD_WIDTH,
      top: region.rect.y * MANSION_WORLD_HEIGHT,
      right: (region.rect.x + region.rect.width) * MANSION_WORLD_WIDTH,
      bottom: (region.rect.y + region.rect.height) * MANSION_WORLD_HEIGHT
    };
  }

  const xs = region.points.map((point) => point.x * MANSION_WORLD_WIDTH);
  const ys = region.points.map((point) => point.y * MANSION_WORLD_HEIGHT);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys)
  };
}

export interface RoomFocusTransform extends Point {
  zoom: number;
}

export function roomFocusTransform(
  region: SceneRegion,
  drawerSide: DrawerSide
): RoomFocusTransform {
  const bounds = regionBounds(region);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const scaledWidth = WORLD_DISPLAY_WIDTH * ROOM_FOCUS_ZOOM;
  const scaledHeight = WORLD_DISPLAY_HEIGHT * ROOM_FOCUS_ZOOM;
  const focusCenterX = drawerSide === "left"
    ? STAGE_CANVAS_WIDTH - ROOM_FOCUS_CENTER_X
    : ROOM_FOCUS_CENTER_X;
  const targetX = focusCenterX - centerX * WORLD_SCALE * ROOM_FOCUS_ZOOM;
  const targetY = ROOM_FOCUS_CENTER_Y - centerY * WORLD_SCALE * ROOM_FOCUS_ZOOM;

  return {
    x: Math.max(STAGE_CANVAS_WIDTH - scaledWidth, Math.min(0, targetX)),
    y: Math.max(STAGE_CANVAS_HEIGHT - scaledHeight, Math.min(0, targetY)),
    zoom: ROOM_FOCUS_ZOOM
  };
}

export interface RoomPreviewStyle {
  width: number;
  height: number;
  left: number;
  top: number;
}

export function roomPreviewImageStyle(region: SceneRegion): RoomPreviewStyle {
  const bounds = regionBounds(region);
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const cropScale = Math.max(
    ROOM_PREVIEW_WIDTH / (width * 1.18),
    ROOM_PREVIEW_HEIGHT / (height * 1.18)
  );

  return {
    width: MANSION_WORLD_WIDTH * cropScale,
    height: MANSION_WORLD_HEIGHT * cropScale,
    left: ROOM_PREVIEW_WIDTH / 2 - centerX * cropScale,
    top: ROOM_PREVIEW_HEIGHT / 2 - centerY * cropScale
  };
}

function characterNameBand(region: SceneRegion) {
  const bounds = regionBounds(region);
  const height = bounds.bottom - bounds.top;
  const requiredHeight = CHARACTER_AVATAR + 6 + CHARACTER_NAME_FS + CHARACTER_TOP_CLEARANCE;
  const padding = Math.max(0, Math.min(CHARACTER_BOTTOM_PAD, height - requiredHeight));
  return CHARACTER_NAME_FS + padding;
}

export function regionAnchor(
  region: SceneRegion,
  edge: "top-right" | "bottom-center"
): Point {
  const bounds = regionBounds(region);
  if (edge === "top-right") {
    return { x: bounds.right - 28, y: bounds.top + 30 };
  }
  return {
    x: (bounds.left + bounds.right) / 2,
    y: bounds.bottom - characterNameBand(region)
  };
}

/** Returns the center of a marker in a right-to-left room-top slot. */
export function markerSlot(
  region: SceneRegion,
  index: number,
  markerSize: number
): Point {
  const bounds = regionBounds(region);
  return {
    x: bounds.right - MARKER_SLOT_INSET - markerSize / 2
      - index * (markerSize + MARKER_SLOT_GAP),
    y: bounds.top + MARKER_SLOT_INSET + markerSize / 2
  };
}

export function regionLabelY(region: SceneRegion) {
  return regionBounds(region).bottom - 16;
}
