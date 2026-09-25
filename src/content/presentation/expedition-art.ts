import { manorEnemyArt, manorScenes } from "./old-manor";
import { tideEnemyArt } from "./tide-cave";
import { reefEnemyArt, reefScenes } from "./tide-reef";

const manorLocations: Record<string, string> = {
  "old-manor.welcoming-hall": "迎客门厅",
  "old-manor.service-corridor": "服务走廊",
  "old-manor.banquet-hall": "宴会厅",
};
export const expeditionScenes: Record<string, {background: string; location: string}> = {
  ...Object.fromEntries(Object.entries(manorScenes).map(([id, background]) => [id, {background, location: manorLocations[id]}])),
  ...reefScenes,
};
const enemyArt = {...manorEnemyArt, ...reefEnemyArt};
export function expeditionEnemyArt(definition: {id: string; artId?: string}) {
  return enemyArt[definition.artId ?? ""] ?? tideEnemyArt[definition.id];
}
