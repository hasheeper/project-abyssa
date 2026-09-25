/** Read-only presentation receipts. Gameplay owns banking, multipliers and retention. */
export type LootStack = { itemId: string; quantity: number };
export type LootPocket = { copper: number; items: LootStack[] };
export type LootOutcome = "failed" | "retreated" | "cleared";
export type LootSettlement = {
  questReturned?: LootPocket; questLost?: LootPocket;
  outcome: LootOutcome;
  layer: number;
  banked: LootPocket;
  unbanked: LootPocket;
  returned: LootPocket;
  lostUnbanked: LootPocket;
  lostBanked: LootPocket;
};
export type LootLedgerView = { questItems?: LootPocket; layer: number; banked: LootPocket; unbanked: LootPocket };
export const itemCount = (pocket: LootPocket) => pocket.items.reduce((sum, item) => sum + item.quantity, 0);
export const hasLoot = (pocket: LootPocket) => pocket.copper > 0 || itemCount(pocket) > 0;
