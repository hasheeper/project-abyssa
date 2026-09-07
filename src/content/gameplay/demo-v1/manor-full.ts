import type { DemoCatalog } from "../../../game-core/contracts";
import { MANOR_CATALOG_DATA } from "./manor";

// The published three-layer Catalog is immutable. This is a separate release.
const data = structuredClone(MANOR_CATALOG_DATA);
const enemy = "enemy.old-manor.", encounter = "encounter.old-manor.", room = "room.old-manor.";
data.catalogId = "abyssa.demo";
data.rulesVersion = 3;
data.manor = {
  firstClearRouteId: "old-manor.first-clear", maintenanceRouteId: "old-manor.maintenance",
  boss: {definitionId: enemy + "puppet-heiress", guestId: enemy + "waiting-guest", maxGuests: 3, summonBudget: 6},
  firstClearReward: {id: "reward.old-manor.first-clear", gold: 20}, storyId: "story.old-manor.release",
};
data.enemies[enemy + "puppet-heiress"] = {id: enemy + "puppet-heiress", name: "末席的提线千金", artId: "old-manor.puppet-heiress", hp: 18, attack: 2, bounty: 18, behavior: "heiress"};
const j = data.journey!;
j.defaultRouteId = data.manor.firstClearRouteId;
j.depthPercent = [100, 125, 150, 175, 200];
j.rooms[room + "first.exit"] = {...j.rooms[room + "first.exit"], kind: "exit", canContinue: true};
function battle(id: string, sceneId: string, enemies: string[]) {
  const encounterId = encounter + id, roomId = room + id;
  data.encounters[encounterId] = {id: encounterId, enemyIds: enemies.map(e => enemy + e)};
  j.rooms[roomId] = {id: roomId, kind: "battle", encounterId, sceneId: "old-manor." + sceneId};
  return roomId;
}
battle("first.banquet", "banquet-hall", ["waiting-guest", "waiting-guest", "waiting-guest", "mending-maid"]);
battle("first.heiress", "banquet-hall", ["waiting-guest", "puppet-heiress", "waiting-guest"]);
j.events["event.old-manor.seats"] = {id: "event.old-manor.seats", kind: "seats", name: "空席核对", text: "白布下的椅子被登记作宾客，主位却仍空着。每多一位宾客，千金的举杯便多一分重量。‘还差一位。’这句话越过你们，朝走廊深处重复。", cost: 0, reward: 0};
j.rooms[room + "first.seats"] = {id: room + "first.seats", kind: "event", eventId: "event.old-manor.seats", sceneId: "old-manor.banquet-hall"};
const first = data.routes["old-manor.segment-3"].layers;
data.routes = {
  [data.manor.firstClearRouteId]: {id: data.manor.firstClearRouteId, layers: [...first, [room + "first.banquet", room + "first.seats"], [room + "first.heiress"]]},
};
const maintenance = [
  ["waiting-guest", "waiting-guest", "waiting-guest"],
  ["platter-bearer", "mending-maid", "waiting-guest"],
  ["platter-bearer", "platter-bearer", "mending-maid"],
  ["waiting-guest", "waiting-guest", "waiting-guest", "mending-maid"],
  ["platter-bearer", "platter-bearer", "mending-maid", "waiting-guest"],
].map((ids, i) => [battle(`maintenance.layer-${i + 1}`, i === 0 ? "welcoming-hall" : i < 3 ? "service-corridor" : "banquet-hall", ids)]);
j.rooms[room + "maintenance.exit"] = {id: room + "maintenance.exit", kind: "exit", canContinue: true, sceneId: "old-manor.service-corridor"};
maintenance[2].push(room + "maintenance.exit");
data.routes[data.manor.maintenanceRouteId] = {id: data.manor.maintenanceRouteId, layers: maintenance};
export const FULL_MANOR_CATALOG_DATA: DemoCatalog = data;
