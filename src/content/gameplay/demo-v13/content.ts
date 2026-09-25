import type { D5Catalog } from "../../../game-core/contracts";
import { CHAPTER_ONE_CATALOG_DATA } from "../demo-v12/content";

const previous = structuredClone(CHAPTER_ONE_CATALOG_DATA);

/** Fixed first appraisal. Older catalogs and their economy remain immutable. */
export const SHOP_FOUNDATION_CATALOG_DATA: D5Catalog = {
  ...previous,
  contentVersion: 13,
  enemies: {
    ...previous.enemies,
    "enemy.intro.tide-slime": { ...previous.enemies["enemy.intro.tide-slime"], bounty: 1 },
  },
  loot: {
    quoteVersion: 1,
    definitions: {
      "loot.tutorial.curio": { id: "loot.tutorial.curio", resultId: "appraisal.ship-lamp-ring", appraisalFee: 2, salePrice: 8 },
    },
    grants: [{ id: "grant.tide-cave.curio", definitionId: "loot.tutorial.curio", routeId: "intro.tide-cave.first", roomId: "room.tide-cave.4" }],
  },
};
