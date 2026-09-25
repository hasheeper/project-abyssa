import type { D5Catalog, LootRoomTable, LootTable } from "../../../game-core/contracts";
import { TIDE_REEF_CATALOG_DATA } from "../demo-v20/content";

/** Ordinary drop-table release. Earlier fixed rewards and tutorial editions stay immutable. */
const data = structuredClone(TIDE_REEF_CATALOG_DATA);
data.contentVersion = 21;
const loot = data.loot!;
for (const [key, salePrice] of [
  ["mire-gel", 100], ["scrap-iron", 80], ["copper-parts", 120], ["old-linen", 100],
  ["crossbow-spring", 260], ["blackwood", 180], ["silverware", 300], ["sewing-needle", 160],
  ["clock-parts", 320], ["clock-wheel", 780],
] as const) {
  const id = `loot.salvage.${key}`;
  loot.definitions[id] = {id, resultId: `known.salvage.${key}`, quantity: 1, initiallyKnown: true, appraisalFee: 0, salePrice};
}
for (const [key, salePrice] of [["navigation-compass", 1000], ["napkin-clip", 800], ["clock-reed", 1200]] as const) {
  const id = `loot.curio.${key}`;
  loot.definitions[id] = {id, resultId: `appraisal.${key}`, quantity: 1, appraisalFee: 300, salePrice, scrapPrice: 2};
}
const tables: Record<string, LootTable> = {};
function table(key: string, entries: [string | null, number][]) {
  const id = `table.loot.${key}`;
  tables[id] = {id, entries: entries.map(([definitionId, weight]) => ({definitionId, weight}))};
}
function salvage(key: string, first: string, second: string) {
  table(key, [[`loot.salvage.${first}`, 50], [`loot.salvage.${second}`, 10], [null, 40]]);
}
salvage("mire", "mire-gel", "shell");
salvage("reef-crab", "crab-shell", "shell");
table("shell-leech", [["loot.salvage.shell", 60], [null, 40]]);
salvage("blade", "scrap-iron", "copper-parts");
salvage("crossbow", "scrap-iron", "crossbow-spring");
salvage("hauler", "old-linen", "copper-parts");
salvage("guest", "blackwood", "old-linen");
salvage("waiter", "silverware", "copper-parts");
salvage("maid", "sewing-needle", "old-linen");
table("clockwork", [["loot.salvage.clock-parts", 70], ["loot.salvage.clock-wheel", 30]]);
table("reef-curios", [["loot.salvage.ship-lamp-ring", 75], ["loot.curio.navigation-compass", 25]]);
table("manor-curios", [["loot.curio.napkin-clip", 70], ["loot.curio.clock-reed", 30]]);

const rooms: LootRoomTable[] = [];
function room(routeId: string, roomId: string, sources: string[], pool?: string, chance = 100) {
  rooms.push({id: `source.${roomId}`, routeId, roomId, tableIds: sources.map(id => `table.loot.${id}`),
    ...(pool ? {curio: {tableId: `table.loot.${pool}`, chance}} : {})});
}
const reef = "tide-reef.ordinary";
room(reef, "room.tide-reef.shore-1", ["mire", "mire"]);
room(reef, "room.tide-reef.shore-2", ["reef-crab", "mire"]);
room(reef, "room.tide-reef.grotto-1", ["shell-leech", "mire"]);
room(reef, "room.tide-reef.grotto-2", ["reef-crab", "shell-leech"], "reef-curios", 20);
room(reef, "room.tide-reef.boardwalk", ["blade", "crossbow", "hauler"], "reef-curios");
const first = "old-manor.first-clear", maintenance = "old-manor.maintenance";
room(first, "room.old-manor.first.foyer", ["guest", "guest", "guest"]);
room(first, "room.old-manor.first.service", ["waiter", "maid", "guest"]);
room(first, "room.old-manor.first.butler", ["clockwork"], "manor-curios", 20);
room(first, "room.old-manor.first.banquet", ["guest", "guest", "guest", "maid"]);
// This is the stopped room mechanism, not the rescued heiress or her guests.
room(first, "room.old-manor.first.heiress", ["clockwork"], "manor-curios");
room(maintenance, "room.old-manor.maintenance.layer-1", ["guest", "guest", "guest"]);
room(maintenance, "room.old-manor.maintenance.layer-2", ["waiter", "maid", "guest"]);
room(maintenance, "room.old-manor.maintenance.layer-3", ["waiter", "waiter", "maid"], "manor-curios", 20);
room(maintenance, "room.old-manor.maintenance.layer-4", ["guest", "guest", "guest", "maid"]);
room(maintenance, "room.old-manor.maintenance.layer-5", ["clockwork"], "manor-curios");
loot.grants = loot.grants.filter(grant => grant.routeId === data.tutorial!.routeId);
loot.dropTables = {version: 1, tables, rooms};
export const ORDINARY_DROPS_CATALOG_DATA: D5Catalog = data;
