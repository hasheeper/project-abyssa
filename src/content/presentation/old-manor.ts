import memoryMarietta from "../../assets/battle/old-manor/marietta-memory-boss.png";
import clockworkBeast from "../../assets/battle/old-manor/clockwork-beast.png";
import waitingGuest from "../../assets/battle/old-manor/waiting-guest.png";
import platterBearer from "../../assets/battle/old-manor/platter-bearer.png";
import mendingMaid from "../../assets/battle/old-manor/mending-maid.png";
import curtainButler from "../../assets/battle/old-manor/curtain-butler.png";
import hall from "../../assets/backgrounds/old-manor/welcoming-hall.jpg";
import corridor from "../../assets/backgrounds/old-manor/service-corridor.jpg";
import heiress from "../../assets/battle/old-manor/last-seat-puppet-heiress.png";
import banquet from "../../assets/backgrounds/old-manor/banquet-hall.jpg";
export const manorEnemyArt: Record<string, {url: string; height: number}> = {
  "old-manor.clockwork-beast": {url: clockworkBeast, height: 238},
  "memory.marietta": {url: memoryMarietta, height: 260},
  "old-manor.waiting-guest": {url: waitingGuest, height: 177},
  "old-manor.platter-bearer": {url: platterBearer, height: 191},
  "old-manor.mending-maid": {url: mendingMaid, height: 202},
  "old-manor.curtain-butler": {url: curtainButler, height: 267},
  "old-manor.puppet-heiress": {url: heiress, height: 260},
};
export const manorScenes: Record<string, string> = {"old-manor.welcoming-hall": hall, "old-manor.service-corridor": corridor, "old-manor.banquet-hall": banquet};
