import type { D5Catalog } from "../../../game-core/contracts";
import { STARTER_REWARD_CATALOG_DATA } from "../demo-v15/content";

/** A fresh guided save introduces the shop once, after the tutorial return. */
export const SHOP_INTRODUCTION_CATALOG_DATA: D5Catalog = {
  ...structuredClone(STARTER_REWARD_CATALOG_DATA),
  contentVersion: 16,
  shopIntroduction: {id: "story.shop.first-visit", shopId: "shop.mansion", lastStep: 3},
};
