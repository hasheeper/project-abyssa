export type MansionRegionKind = "room" | "building" | "trace" | "other";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface MansionRegion {
  id: string;
  label: string;
  kind: MansionRegionKind;
  points: NormalizedPoint[];
}

export interface NormalizedRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MansionRectangle {
  id: string;
  label: string;
  kind: MansionRegionKind;
  rect: NormalizedRectangle;
}

export interface MansionRegionFile {
  version: 2;
  canvas: {
    width: number;
    height: number;
  };
  rectangles: MansionRectangle[];
  regions: MansionRegion[];
}

export interface MansionLayer {
  id: string;
  name: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  order: number;
}

export interface MansionPsdManifest {
  version: 1;
  source: string;
  width: number;
  height: number;
  layers: MansionLayer[];
}
