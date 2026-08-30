/* ============ 稀有度:全库唯一来源 ============
 *
 * 这套 5 档稀有度原先只活在 src/apps/shop/ShopPage.tsx 里(type ItemRarity +
 * rarityRanks + 一张 Record<itemId, ItemRarity> 侧表),配色则在 shop.css 里
 * **声明了两遍** —— 一遍给 28px 的列表图标,一遍给 80px 的详情槽。
 *
 * 提到 shared 的理由不是"看起来该共享",而是稀有度**已经在驱动三件事**:
 *   1. 配色     --item-rarity / --item-rarity-soft
 *   2. 图标选择 rank 作为 quality 传进 resolveItemIcon,让它在同义图标里挑
 *               (round-potion q1 vs standing-potion q4)
 *   3. 边框/辉光强度
 * 第 2 条意味着稀有度是**物品语义**的一部分,不是 shop 的皮肤。
 *
 * 注意 rank 同时就是宝石格数(bronze 1 颗 … mythic 5 颗),两者故意是同一个数,
 * 不要拆成两张表。
 */

export type ItemRarity = "bronze" | "silver" | "gold" | "amethyst" | "mythic";

/** 稀有度序号 1..5。既是宝石格数,也是传给图标解析器的 quality。 */
export const ITEM_RARITY_RANKS: Record<ItemRarity, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  amethyst: 4,
  mythic: 5
};

/** 从低到高,供选择器/图例按序遍历。 */
export const ITEM_RARITY_ORDER: readonly ItemRarity[] = [
  "bronze",
  "silver",
  "gold",
  "amethyst",
  "mythic"
];

/** 中文档位名,用于无障碍名与提示文本。 */
export const ITEM_RARITY_LABELS: Record<ItemRarity, string> = {
  bronze: "凡品",
  silver: "精良",
  gold: "珍品",
  amethyst: "秘宝",
  mythic: "神话"
};

export const DEFAULT_ITEM_RARITY: ItemRarity = "bronze";

/** 把任意输入收敛成合法档位,脏数据一律落到 bronze 而非抛错。 */
export function normalizeItemRarity(value: string | null | undefined): ItemRarity {
  return value != null && value in ITEM_RARITY_RANKS
    ? (value as ItemRarity)
    : DEFAULT_ITEM_RARITY;
}

export function itemRarityRank(value: string | null | undefined): number {
  return ITEM_RARITY_RANKS[normalizeItemRarity(value)];
}
