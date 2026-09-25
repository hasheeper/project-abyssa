import { LOOT_KIND_LABELS, lootQualityLabel, type LootItemView } from "./loot-item";
import { LootKindMark } from "./LootKindMark";

/** Two independent cues, without introducing another section or disclosure. */
export function LootItemMeta({ item }: { item: LootItemView }) {
  return <span className="loot-item-meta">
    <span className="loot-item-meta__kind"><LootKindMark kind={item.kind}/>{LOOT_KIND_LABELS[item.kind]}</span>
    <span className="loot-item-meta__separator" aria-hidden="true">·</span>
    <span className="loot-item-quality abyssa-rarity" data-rarity={item.rarity}>
      <i aria-hidden="true"/>{lootQualityLabel(item)}
    </span>
  </span>;
}
