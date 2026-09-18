import type { LightTone } from "./lighting";

export interface MansionLightSource {
  id: string;
  /** Pixel anchors measured against the original 5162 × 1910 map, not room centres. */
  x: number;
  y: number;
  core: readonly [number, number];
  reach: readonly [number, number];
  tone?: LightTone;
  /** Zero for reflected/window light: never manufacture a luminous spot there. */
  emission?: number;
  strength?: number;
}

/** Local falloff keeps ink, masonry and furniture readable around each source.
 * In the current art the plaza contains a bench and a food tray, not a fire;
 * the open lookout also has no beacon. Neither gets an invented emitter. */
const SOURCES: Readonly<Record<string, readonly MansionLightSource[]>> = {
  hall: [{id: "hearth", x: 1601, y: 1271, core: [26, 22], reach: [145, 105]}],
  kaelHut: [{id: "stove", x: 3888, y: 1181, core: [13, 29], reach: [88, 89]}],
  workshop: [{id: "forge", x: 1472, y: 1525, core: [18, 19], reach: [97, 89]}],
  kitchen: [{id: "stove-embers", x: 2132, y: 1280, core: [36, 12], reach: [110, 73], emission: 0}],
  tibby: [{id: "hanging-lantern", x: 470, y: 1379, core: [10, 16], reach: [91, 105]}],
  towerHall: [{id: "signal-lantern", x: 1336, y: 1120, core: [7, 15], reach: [67, 85], emission: .35}],
  abyssa: [{id: "bedside-crystal", x: 1940, y: 918, core: [10, 21], reach: [70, 76], tone: "cold", emission: .55}],
  greenhouse: [
    {id: "blue-herb", x: 3373, y: 1167, core: [13, 26], reach: [60, 75], tone: "blue", emission: .78},
    {id: "gold-herb", x: 3420, y: 1163, core: [14, 23], reach: [58, 70], tone: "lamp", emission: .78}
  ],
  library: [
    {id: "west-flame", x: 1839, y: 1746, core: [10, 18], reach: [69, 81]},
    {id: "shelf-flame", x: 1968, y: 1701, core: [8, 14], reach: [66, 74]},
    {id: "back-flame", x: 2059, y: 1730, core: [8, 13], reach: [60, 70]},
    {id: "east-flame", x: 2167, y: 1757, core: [10, 18], reach: [65, 80]}
  ],
  array: [
    {id: "crystal", x: 2383, y: 1736, core: [15, 42], reach: [123, 126]},
    {id: "west-flame", x: 2252, y: 1763, core: [8, 14], reach: [56, 75], tone: "blue", strength: .8},
    {id: "east-flame", x: 2519, y: 1755, core: [8, 14], reach: [56, 75], tone: "blue", strength: .8},
    {id: "floor-sigil", x: 2381, y: 1830, core: [53, 9], reach: [82, 31], emission: .15, strength: .4}
  ],
  seal: [
    {id: "door-seam", x: 2763, y: 1788, core: [5, 79], reach: [26, 106], emission: .52},
    {id: "chain-binding", x: 2756, y: 1798, core: [16, 13], reach: [65, 53], emission: .68, strength: .75},
    {id: "west-runes", x: 2647, y: 1800, core: [7, 57], reach: [28, 85], emission: .5, strength: .7},
    {id: "east-runes", x: 2877, y: 1799, core: [7, 57], reach: [28, 85], emission: .5, strength: .7}
  ],
  // These rooms have no painted oil lamp. Retain restrained window/room ambience
  // instead of putting the former generic warm hotspot on a wall or a hammock.
  eustice: [{id: "window", x: 4375, y: 947, core: [27, 39], reach: [83, 77], tone: "cold", emission: 0, strength: .35}],
  norma: [{id: "window", x: 4595, y: 947, core: [26, 38], reach: [83, 77], tone: "cold", emission: 0, strength: .35}],
  elora: [{id: "window", x: 4374, y: 1140, core: [22, 33], reach: [79, 71], tone: "cold", emission: 0, strength: .35}],
  kororo: [{id: "blue-lamp", x: 4669, y: 1157, core: [7, 9], reach: [50, 46], tone: "blue", emission: .2, strength: .5}]
};

export function mansionLightSources(roomId: string): readonly MansionLightSource[] {
  return SOURCES[roomId] ?? [];
}

/** Live ambience and the baked source use exactly the same anchor and core. */
export function mansionSourceGlowBounds(source: MansionLightSource) {
  const rx = source.core[0] * 2, ry = source.core[1] * 2;
  return {left: source.x - rx, top: source.y - ry, width: rx * 2, height: ry * 2};
}
