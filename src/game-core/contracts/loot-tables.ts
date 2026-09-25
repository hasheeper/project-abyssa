import * as v from "./validation";
import { sha256 } from "./sha256";
import type { LootDefinition, LootDrop, LootTable, LootTables } from "./loot-types";

type Routes = Record<string, {layers: string[][]}>;

export function validateLootTables(raw: unknown, definitions: Record<string, LootDefinition>, routes: Routes): LootTables {
  const c = v.record(raw, "loot.dropTables", ["version", "tables", "rooms"]);
  v.choice(c.version, [1], "loot.dropTables.version");
  const tables = v.record(c.tables, "loot.tables");
  if (Object.keys(tables).length > 64) v.invalid("loot.tables", "Too many loot tables");
  for (const [id, rawTable] of Object.entries(tables)) {
    const table = v.record(rawTable, "loot.table", ["id", "entries"]);
    if (v.id(table.id, "loot.table.id") !== id) v.invalid("loot.table.id", "Table identity differs");
    const seen = new Set<string | null>();
    let total = 0;
    for (const rawEntry of v.list(table.entries, "loot.entries", 16)) {
      const e = v.record(rawEntry, "loot.entry", ["definitionId", "weight"]);
      const key = e.definitionId === null ? null : v.id(e.definitionId, "loot.definitionId");
      if (key !== null) {
        const d = v.reference(definitions, key, "loot.definitionId");
        if ((d.quantity ?? 1) !== 1 || d.bundleWith || d.freeAppraisalGrantIds || d.sellable === false)
          v.invalid("loot.entry", "Random rewards require individual, ordinary tradable items");
      }
      if (seen.has(key)) v.invalid("loot.entry", "Duplicate result");
      seen.add(key); total += v.number(e.weight, "loot.weight", 1, 100);
    }
    if (total !== 100) v.invalid("loot.weights", "Weights must total 100");
  }
  const ids = new Set<string>(), rooms = new Set<string>(), limits = new Map<string, number>();
  const curioPools = new Map<string, string>();
  for (const rawRoom of v.list(c.rooms, "loot.rooms", 100)) {
    const r = v.record(rawRoom, "loot.room", ["id", "routeId", "roomId", "tableIds"], ["curio"]);
    const id = v.id(r.id, "loot.room.id"), routeId = v.id(r.routeId, "loot.routeId"), roomId = v.id(r.roomId, "loot.roomId");
    const route = v.reference(routes, routeId, "loot.routeId");
    const roomKey = `${routeId}:${roomId}`;
    if (ids.has(id) || rooms.has(roomKey) || !route.layers.flat().includes(roomId)) v.invalid("loot.room", "Duplicate or foreign room binding");
    ids.add(id); rooms.add(roomKey);
    const tableIds = v.list(r.tableIds, "loot.tableIds", 20).map(t => v.id(t, "loot.tableId"));
    for (const tableId of tableIds) {
      const table = v.reference(tables, tableId, "loot.tableId") as LootTable;
      if (table.entries.some(e => e.definitionId && !definitions[e.definitionId].initiallyKnown)) v.invalid("loot.table", "Ordinary tables require known salvage");
    }
    if (r.curio !== undefined) {
      const curio = v.record(r.curio, "loot.curio", ["tableId", "chance"]);
      const tableId = v.id(curio.tableId, "loot.curio.tableId"), table = v.reference(tables, tableId, "loot.curio.tableId") as LootTable;
      v.number(curio.chance, "loot.curio.chance", 1, 100);
      if (table.entries.some(e => !e.definitionId || definitions[e.definitionId].initiallyKnown)) v.invalid("loot.curio", "Curio pool requires unidentified items");
      if (curioPools.has(routeId) && curioPools.get(routeId) !== tableId) v.invalid("loot.curio", "A route uses one no-repeat curio pool");
      curioPools.set(routeId, tableId);
    }
    const count = (limits.get(routeId) ?? 0) + tableIds.length + (r.curio ? 1 : 0);
    if (count > 32) v.invalid("loot.rooms", "Route exceeds 32 loot instances");
    limits.set(routeId, count);
  }
  const result = raw as LootTables;
  for (const [route, table] of curioPools) {
    if (result.rooms.filter(r => r.routeId === route && r.curio).length > result.tables[table].entries.length)
      v.invalid("loot.curio", "Curio pool cannot satisfy all unique milestones");
  }
  return result;
}

/** Addressed random draws: isolated from combat, stable across retries and load order. */
function draw(seed: number, address: unknown[]) {
  return Number.parseInt(sha256(v.canonicalJson(["ordinary-loot.v1", seed, ...address])).slice(0, 13), 16) / 0x10000000000000;
}
function pick(table: LootTable, value: number, excluded: Set<string>) {
  const entries = table.entries.filter(e => !e.definitionId || !excluded.has(e.definitionId));
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let cursor = value * total;
  for (const entry of entries) {cursor -= entry.weight; if (cursor < 0) return entry.definitionId;}
  return null;
}

export function earnedTableLoot(content: LootTables, routes: Routes, runId: string, routeId: string, completedRoomIds: readonly string[], seed: number): LootDrop[] {
  const drops: LootDrop[] = [], curios = new Set<string>(), completed = new Set(completedRoomIds);
  const bindings = new Map(content.rooms.filter(r => r.routeId === routeId).map(r => [r.roomId, r]));
  routes[routeId].layers.forEach((layer, l) => layer.forEach((definitionRoomId, r) => {
    const binding = bindings.get(definitionRoomId), roomId = `${runId}:room:${l + 1}:${r + 1}`;
    if (!binding || !completed.has(roomId)) return;
    const award = (tableId: string, slot: string, excluded: Set<string>) => {
      const address = [content.version, runId, routeId, binding.id, tableId, slot];
      const definitionId = pick(content.tables[tableId], draw(seed, address), excluded);
      if (!definitionId) return;
      const grantId = `drop:${binding.id}:${slot}`;
      drops.push({instanceId: `loot:${sha256(v.canonicalJson([runId, grantId])).slice(0, 32)}`, definitionId, grantId, runId, roomId});
      if (slot === "curio") curios.add(definitionId);
    };
    binding.tableIds.forEach((tableId, index) => award(tableId, `slot-${index + 1}`, new Set()));
    if (binding.curio && draw(seed, [content.version, runId, routeId, binding.id, "curio-chance"]) * 100 < binding.curio.chance)
      award(binding.curio.tableId, "curio", curios);
  }));
  return drops;
}
