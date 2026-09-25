import * as v from "./validation";
import { sha256 } from "./sha256";
import { earnedTableLoot, validateLootTables } from "./loot-tables";

export type { LootDefinition, LootGrant, LootContent, LootDrop, OwnedLoot, LootTrade } from "./loot-types";
import type { LootDefinition, LootGrant, LootContent, LootDrop, OwnedLoot } from "./loot-types";

/** Stable room identities are the same ones used by journey completion proofs. */
export function earnedLoot(content: LootContent, routes: Record<string, { layers: string[][] }>, runId: string, routeId: string, completedRoomIds: readonly string[], seed?: number): LootDrop[] {
  const fixed = content.grants.filter(g => g.routeId === routeId).flatMap(grant => {
    const layers = routes[routeId].layers;
    const layer = layers.findIndex(rooms => rooms.includes(grant.roomId));
    const roomId = `${runId}:room:${layer + 1}:${layers[layer].indexOf(grant.roomId) + 1}`;
    return completedRoomIds.includes(roomId) ? [{
      instanceId: `loot:${sha256(v.canonicalJson([runId, grant.id])).slice(0, 32)}`,
      definitionId: grant.definitionId, grantId: grant.id, runId, roomId,
    }] : [];
  }).sort((a, b) => completedRoomIds.indexOf(a.roomId) - completedRoomIds.indexOf(b.roomId));
  if (!content.dropTables?.rooms.some(room => room.routeId === routeId)) return fixed;
  v.number(seed, "loot.seed", 0, 0xffffffff);
  return [...fixed, ...earnedTableLoot(content.dropTables, routes, runId, routeId, completedRoomIds, seed!)];
}

export function initialLootResult(definition: LootDefinition): string | null {
  return definition.initiallyKnown ? definition.resultId : null;
}
export function lootAppraisalFee(definition: LootDefinition, item: Pick<OwnedLoot, "grantId">): number {
  return definition.freeAppraisalGrantIds?.includes(item.grantId) ? 0 : definition.appraisalFee;
}
export function lootQuantity(definition: LootDefinition, item: Pick<OwnedLoot, "sampled">): number {
  return item.sampled && definition.id === "loot.tutorial.cross-coins" ? 11 : definition.quantity ?? 1;
}
export function lootSalePrice(definition: LootDefinition, item: Pick<OwnedLoot, "resultId" | "shopVisitOffer">): number | null {
  if (definition.sellable === false) return null;
  return item.resultId === definition.resultId ? item.shopVisitOffer === 1 && definition.id === "loot.tutorial.barrier-nail" ? 400 : definition.salePrice : definition.scrapPrice ?? null;
}

export function validateLootContent(raw: unknown, routes: Record<string, { layers: string[][] }>, copper = false, tables = false): LootContent {
  const c = v.record(raw, "loot", ["quoteVersion", "definitions", "grants"], tables ? ["dropTables"] : []);
  v.number(c.quoteVersion, "loot.quoteVersion", 1);
  const definitions = v.record(c.definitions, "loot.definitions");
  for (const [id, raw] of Object.entries(definitions)) {
    const d = v.record(raw, "loot.definition", ["id", "resultId", "appraisalFee", "salePrice"], copper
      ? ["quantity", "initiallyKnown", "sellable", "scrapPrice", "freeAppraisalGrantIds", "bundleWith"] : []);
    if (v.id(d.id, "loot.id") !== id) v.invalid("loot.id", "Definition identity differs");
    v.id(d.resultId, "loot.resultId");
    v.number(d.appraisalFee, "loot.appraisalFee", 0, copper ? 50_000 : 100);
    v.number(d.salePrice, "loot.salePrice", d.sellable === false ? 0 : 1, copper ? 1_000_000 : 1000);
    if (d.quantity !== undefined) v.number(d.quantity, "loot.quantity", 1, 1000);
    if (d.initiallyKnown !== undefined) v.boolean(d.initiallyKnown, "loot.initiallyKnown");
    if (d.sellable !== undefined) v.boolean(d.sellable, "loot.sellable");
    if (d.scrapPrice !== undefined) v.number(d.scrapPrice, "loot.scrapPrice", 1, 1000);
    if (d.freeAppraisalGrantIds !== undefined) v.ids(d.freeAppraisalGrantIds, "loot.freeAppraisalGrantIds", 32);
    if (d.initiallyKnown && (d.appraisalFee !== 0 || d.freeAppraisalGrantIds !== undefined || d.scrapPrice !== undefined)) v.invalid("loot", "Known items have no appraisal service");
    if (d.bundleWith !== undefined) {
      const parent = v.reference(definitions, d.bundleWith, "loot.bundleWith") as LootDefinition;
      if (parent.id === id || parent.bundleWith || parent.sellable === false || !d.initiallyKnown || d.sellable === false) v.invalid("loot.bundleWith", "Bundled scrap requires a sellable parent and cannot nest");
    }
  }
  const ids = new Set<string>();
  for (const raw of v.list(c.grants, "loot.grants", 32)) {
    const g = v.record(raw, "loot.grant", ["id", "definitionId", "routeId", "roomId"]);
    const id = v.id(g.id, "loot.grant.id");
    if (ids.has(id)) v.invalid("loot.grants", "Duplicate grant");
    ids.add(id);
    v.reference(definitions, g.definitionId, "loot.definitionId");
    const route = v.reference(routes, g.routeId, "loot.routeId");
    if (!route.layers.flat().includes(v.id(g.roomId, "loot.roomId"))) v.invalid("loot.roomId", "Room outside grant route");
  }
  if (c.dropTables !== undefined) {
    const data = validateLootTables(c.dropTables, definitions as Record<string, LootDefinition>, routes);
    if (data.rooms.some(r => (c.grants as LootGrant[]).some(g => g.routeId === r.routeId)))
      v.invalid("loot", "A random route cannot also receive fixed grants");
  }
  return raw as LootContent;
}
