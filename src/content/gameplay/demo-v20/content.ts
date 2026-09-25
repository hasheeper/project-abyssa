import type { D5Catalog } from "../../../game-core/contracts";
import { COPPER_ECONOMY_CATALOG_DATA } from "../demo-v17/content";

/** Ordinary reef release. Published tutorial/manor/AIRP editions keep their identities. */
const data = structuredClone(COPPER_ECONOMY_CATALOG_DATA);
data.contentVersion = 20;
const routeId = "tide-reef.ordinary";
data.expeditions = {
  [routeId]: {id: routeId, nodeId: "cave", name: "潮声溶洞", englishName: "Tidecall Grotto",
    skin: "timber", unlock: "after-tutorial", ending: "plain", grantsGrowth: false,
    brief: {flavor: "穿过雾滩与洞内石阶，沿废弃的走私栈道深入黑礁。", threats: ["礁蟹耐打，留意攻击分配", "海蛭干扰下一回合的命数骰", "弩手蓄力后射击"]}},
};
for (const [key, name, artId, hp, attack, bounty, behavior] of [
  ["slime", "浊泥史莱姆", "enemy.slime.mire", 3, 1, 100, "attack"],
  ["reef-crab", "硬壳礁蟹", "enemy.beast.reef-crab", 8, 1, 300, "attack"],
  ["shell-leech", "藏壳海蛭", "enemy.beast.shell-leech", 3, 0, 200, "seal"],
  ["blade", "亡命徒·刀手", "enemy.outlaw.blade", 4, 1, 200, "attack"],
  ["crossbow", "亡命徒·弩手", "enemy.outlaw.crossbow", 5, 2, 300, "charge"],
  ["hauler", "亡命徒·扛夫", "enemy.outlaw.hauler", 8, 2, 400, "attack"],
] as const) {
  const id = `enemy.tide-reef.${key}`;
  data.enemies[id] = {id, name, artId, hp, attack, bounty, behavior};
}
const groups = [
  ["shore-1", "shore", ["slime", "slime"]],
  ["shore-2", "shore", ["reef-crab", "slime"]],
  ["grotto-1", "grotto", ["shell-leech", "slime"]],
  ["grotto-2", "grotto", ["reef-crab", "shell-leech"]],
  ["boardwalk", "boardwalk", ["blade", "crossbow", "hauler"]],
] as const;
for (const [key, scene, enemies] of groups) {
  const id = `room.tide-reef.${key}`, encounterId = `encounter.tide-reef.${key}`;
  data.encounters[encounterId] = {id: encounterId, enemyIds: enemies.map(key => `enemy.tide-reef.${key}`)};
  data.journey!.rooms[id] = {id, kind: "battle", encounterId, sceneId: `scene.tide-reef.${scene}`};
}
const exit = "room.tide-reef.exit-2";
data.journey!.rooms[exit] = {id: exit, kind: "exit", canContinue: true, sceneId: "scene.tide-reef.grotto"};
data.routes[routeId] = {id: routeId, layers: [
  ["room.tide-reef.shore-1", "room.tide-reef.shore-2"],
  ["room.tide-reef.grotto-1", "room.tide-reef.grotto-2", exit],
  ["room.tide-reef.boardwalk"],
]};
for (const [key, salePrice] of [["shell", 80], ["crab-shell", 260]] as const) {
  const id = `loot.salvage.${key}`;
  data.loot!.definitions[id] = {id, resultId: `known.salvage.${key}`, quantity: 1, initiallyKnown: true, appraisalFee: 0, salePrice};
}
data.loot!.definitions["loot.salvage.ship-lamp-ring"] = {id: "loot.salvage.ship-lamp-ring", resultId: "appraisal.ship-lamp-ring",
  quantity: 1, appraisalFee: 300, salePrice: 600, scrapPrice: 2};
for (const [room, key] of [["shore-1", "shell"], ["shore-2", "crab-shell"], ["grotto-1", "shell"], ["grotto-2", "crab-shell"], ["boardwalk", "ship-lamp-ring"]]) {
  data.loot!.grants.push({id: `grant.tide-reef.${room}`, routeId, roomId: `room.tide-reef.${room}`, definitionId: `loot.salvage.${key}`});
}
export const TIDE_REEF_CATALOG_DATA: D5Catalog = data;
