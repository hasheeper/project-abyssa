export type MapLocationId = "cave" | "tower" | "church";

export interface MapLocationConfig {
  id: MapLocationId;
  name: string;
  englishName: string;
  imageUrl: string;
  position: { x: number; z: number };
  height: number;
  plateY: number;
}

export const MAP_GROUND_URL = "https://files.catbox.moe/n68e83.png";

const INITIAL_MAP_LOCATIONS: MapLocationConfig[] = [
  {
    id: "church",
    name: "风化圣堂",
    englishName: "The Weathered Sanctum",
    imageUrl: "https://files.catbox.moe/orgrb3.png",
    position: { x: -10.6, z: -3.5 },
    height: 2.9,
    plateY: -0.65
  },
  {
    id: "tower",
    name: "废弃哨塔",
    englishName: "The Abandoned Watchtower",
    imageUrl: "https://files.catbox.moe/im16jb.png",
    position: { x: -0.6, z: 0.9 },
    height: 3.5,
    plateY: -0.65
  },
  {
    id: "cave",
    name: "潮声溶洞",
    englishName: "Tidecall Grotto",
    imageUrl: "https://files.catbox.moe/vn7j2p.png",
    position: { x: 7.8, z: -4.5 },
    height: 2.8,
    plateY: -0.75
  }
];

export function cloneMapLocations(locations = INITIAL_MAP_LOCATIONS): MapLocationConfig[] {
  return locations.map((location) => ({
    ...location,
    position: { ...location.position }
  }));
}
