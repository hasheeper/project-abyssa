import type { PublicAppraisal } from "../../game-core/contracts/expedition-appraisal";
import type { ShopLootPresentation } from "../../content/presentation/shop-loot";
import type { ShopDialogueLine } from "../../content/presentation/shop-dialogue";
import { resolveItemIcon } from "../../assets/icons/items/catalog";
import { ITEM_RARITY_RANKS } from "../../shared/ui/items/rarity";

/** The existing small counter dialogue consumes these lines; this is not an AVG story. */
export function presentGeneratedShopLoot(copy: PublicAppraisal): ShopLootPresentation & {generated: true; knownSelection?: ShopDialogueLine} {
  const known = copy.identified;
  const unknownIconUrl = resolveItemIcon(copy.unknownName).assetUrl;
  const iconUrl = known ? resolveItemIcon({name: known.name, quality: ITEM_RARITY_RANKS[known.rarity]}).assetUrl : unknownIconUrl;
  return {generated: true, category: "curio", quantity: 1, iconUrl, unknownIconUrl,
    unknownName: copy.unknownName, appearance: copy.appearance, name: known?.name ?? copy.unknownName,
    description: known?.description ?? copy.appearance, discovery: copy.appearance,
    teaser: copy.selectUnknown, appraisal: known?.appraisal ?? [],
    sold: known?.sold ?? {text: "按废料收下啦，钱收好。", emotion: "smile"},
    offer: {text: "还没认过的，只能按柜台上的废料价收哦。", emotion: "wry"},
    kept: {text: "先收好吧，想卖的时候再拿来。", emotion: "smile"},
    ...(known ? {rarity: known.rarity, knownSelection: known.selectKnown} : {})};
}
