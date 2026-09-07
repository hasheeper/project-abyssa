import type { D5Catalog } from "../../../game-core/contracts";
import { D5_CATALOG_DATA } from "../demo-v2/foundation";

/** New immutable content identity; published v3/v4 histories keep their original catalogs. */
const data: D5Catalog = structuredClone(D5_CATALOG_DATA);
data.contentVersion = 3;
data.economy = {
  shopId: "shop.mansion", quoteVersion: 1,
  freeItemIds: ["item.food", "item.potion"],
  prices: { "item.ward": 4, "item.holy-water": 3, "item.maintenance-kit": 6, "item.lucky-charm": 8, "item.divination-slip": 3 },
};
data.journey!.defaultItems = ["item.food", "item.potion"];
data.enemies["enemy.old-manor.clockwork-beast"] = {
  id: "enemy.old-manor.clockwork-beast", name: "刻仪兽", artId: "old-manor.clockwork-beast",
  hp: 16, attack: 3, bounty: 8, behavior: "charge",
};
data.enemies["enemy.memory.clockwork-beast"] = {
  ...data.enemies["enemy.old-manor.clockwork-beast"], id: "enemy.memory.clockwork-beast", hp: 14, bounty: 0,
};
const maintenance = data.routes[data.manor!.maintenanceRouteId];
const finale = data.journey!.rooms[maintenance.layers[4][0]];
if (finale.kind !== "battle") throw new Error("Maintenance finale must be a battle");
data.encounters[finale.encounterId] = {id: finale.encounterId, enemyIds: ["enemy.old-manor.clockwork-beast"]};
delete data.encounters["encounter.memory.marietta"];
delete data.enemies["enemy.memory.marietta"];
data.encounters["encounter.memory.clockwork"] = {id: "encounter.memory.clockwork", enemyIds: ["enemy.memory.clockwork-beast"]};
data.journey!.rooms["room.memory.marietta"] = {id: "room.memory.marietta", kind: "battle", encounterId: "encounter.memory.clockwork", sceneId: "scene.memory.clockwork"};
Object.assign(data.combat.memory, {encounterId: "encounter.memory.clockwork", bossId: "enemy.memory.clockwork-beast"});
Object.assign(data.progression.chapter, {templateId: "profile.memory.clockwork.v1", encounterId: "encounter.memory.clockwork", bossId: "enemy.memory.clockwork-beast", bossHp: 14, puppetCount: 0});
export const LOOP_CATALOG_DATA = data;
