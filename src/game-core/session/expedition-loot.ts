import type { RuleContext } from "../battle/domain/rule-state";
import type { LootDrop } from "../contracts/loot";

export type ExpeditionLootLedger = { banked: LootDrop[]; unbanked: LootDrop[] };

/** Old catalogs and the authored tutorial keep their existing receipt contract. */
export function hasOrdinaryLoot(catalog: RuleContext, routeId: string) {
  const c = catalog.data;
  return "loot" in c && !!c.loot && routeId !== c.tutorial?.routeId && (c.loot.grants.some(g => g.routeId === routeId) || !!c.loot.dropTables?.rooms.some(r => r.routeId === routeId));
}

export function hasTableLoot(catalog: RuleContext, routeId: string) {
  return "loot" in catalog.data && !!catalog.data.loot?.dropTables?.rooms.some(r => r.routeId === routeId);
}

export function lootPockets(drops: readonly LootDrop[], roomIds: readonly (readonly string[])[], settledLayers: readonly number[]): ExpeditionLootLedger {
  const bankedRooms = new Set(settledLayers.flatMap(layer => roomIds[layer - 1] ?? []));
  return {
    banked: drops.filter(item => bankedRooms.has(item.roomId)),
    unbanked: drops.filter(item => !bankedRooms.has(item.roomId)),
  };
}

/** Keep half the owned lots, rounded down. Odd lots are retained in acquisition
 * order after halving each definition's stack. Instance IDs remain unchanged;
 * a tutorial's twelve-coin lot is never split or subjected to this policy. */
export function retainHalfLoot(drops: readonly LootDrop[]): LootDrop[] {
  const groups = new Map<string, LootDrop[]>();
  for (const drop of drops) groups.set(drop.definitionId, [...(groups.get(drop.definitionId) ?? []), drop]);
  const counts = new Map([...groups].map(([id, items]) => [id, Math.floor(items.length / 2)]));
  let remainder = Math.floor(drops.length / 2) - [...counts.values()].reduce((sum, n) => sum + n, 0);
  for (const [id, items] of groups) if (remainder > 0 && items.length % 2) { counts.set(id, counts.get(id)! + 1); remainder--; }
  return drops.filter(drop => {
    const left = counts.get(drop.definitionId)!;
    if (!left) return false;
    counts.set(drop.definitionId, left - 1);
    return true;
  });
}
