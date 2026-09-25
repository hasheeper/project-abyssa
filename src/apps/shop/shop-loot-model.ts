import type { shopLootPresentation } from "../../content/presentation/shop-loot";

export type ShopMode = "buy" | "sell" | "appraise";
export type ShopLootItem = typeof shopLootPresentation[string] & {
  instanceId: string; resultId: string | null; appraisalFee: number; salePrice: number;
  definitionId?: string; stackable?: boolean;
  generated?: boolean; knownSelection?: typeof shopLootPresentation[string]["teaser"];
  normalAppraisalFee?: number; appraisalReason?: string;
  quantity?: number; appraisable?: boolean; sellable?: boolean; refused?: boolean; bundleTotal?: number;
};

/** View-only stacks. Transactions retain the individual instance identities. */
export function groupShopLoot(items: ShopLootItem[], mode: ShopMode) {
  const groups = new Map<string, {id: string; item: ShopLootItem; owned: number; instanceIds: string[]}>();
  for (const item of items) {
    const id = mode === "sell" && !item.generated && item.stackable && item.definitionId && item.resultId
      ? `stack:${item.definitionId}:${item.resultId}` : item.instanceId;
    const group = groups.get(id);
    if (group) {group.owned += item.quantity ?? 1; group.instanceIds.push(item.instanceId);}
    else groups.set(id, {id, item, owned: item.quantity ?? 1, instanceIds: [item.instanceId]});
  }
  return [...groups.values()];
}
export type ShopLootInventory = {
  items: ShopLootItem[];
  history: {id: string; kind: "appraise" | "sell"; gold: number; item: ShopLootItem}[];
};
