import { ITEM_RARITY_LABELS, type ItemRarity } from "../../../shared/ui/items/rarity";

export const LOOT_KIND_LABELS = {
  quest: "委托物品",
  preparation: "战备道具",
  common: "常规战利品",
  appraisal: "鉴定品",
} as const;

/** Presentation data only. Unidentified finds never carry their hidden grade. */
export type LootItemView = {
  id: string;
  name: string;
  description: string;
  icon: string;
} & (
  | { kind: "preparation" | "common" | "quest"; rarity: ItemRarity }
  | { kind: "appraisal"; rarity: "unknown" }
);

export function lootQualityLabel(item: LootItemView): string {
  return item.rarity === "unknown" ? "品质未知" : ITEM_RARITY_LABELS[item.rarity];
}

export function lootItemLabel(item: LootItemView, quantity: number): string {
  return `${item.name}，数量 ${quantity}，${LOOT_KIND_LABELS[item.kind]}，${lootQualityLabel(item)}`;
}
