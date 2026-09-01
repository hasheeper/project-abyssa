import type {
  MansionRegionKind,
  NormalizedPoint
} from "../../shared/domain/mansion/regions";

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export interface DraftRegion {
  id: string;
  label: string;
  kind: MansionRegionKind;
  points: NormalizedPoint[];
}

export interface DraftRectangle {
  id: string;
  label: string;
  kind: MansionRegionKind;
}

export interface RectangleDrawSession {
  pointerId: number;
  start: NormalizedPoint;
}

export interface PanSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

export type RectangleCorner = "tl" | "tr" | "br" | "bl";

export const REGION_COLORS: Record<MansionRegionKind, string> = {
  room: "#e8ba67",
  building: "#73c9d1",
  trace: "#d58aca",
  other: "#a9bd8d"
};
