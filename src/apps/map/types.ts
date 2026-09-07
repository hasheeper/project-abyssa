import watchersCliffGroundUrl from "../../assets/map/terrain/watchers-cliff-ground.png";
import weatheredSanctumUrl from "../../assets/map/landmarks/weathered-sanctum.png";
import abandonedWatchtowerUrl from "../../assets/map/landmarks/abandoned-watchtower.png";
import tidecallGrottoUrl from "../../assets/map/landmarks/tidecall-grotto.png";

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

export const MAP_GROUND_URL = watchersCliffGroundUrl;

const INITIAL_MAP_LOCATIONS: MapLocationConfig[] = [
  {
    id: "church",
    name: "风化圣堂",
    englishName: "The Weathered Sanctum",
    imageUrl: weatheredSanctumUrl,
    position: { x: -10.6, z: -3.5 },
    height: 2.9,
    plateY: -0.65
  },
  {
    id: "tower",
    name: "废弃哨塔",
    englishName: "The Abandoned Watchtower",
    imageUrl: abandonedWatchtowerUrl,
    position: { x: -0.6, z: 0.9 },
    height: 3.5,
    plateY: -0.65
  },
  {
    id: "cave",
    name: "潮声溶洞",
    englishName: "Tidecall Grotto",
    imageUrl: tidecallGrottoUrl,
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
