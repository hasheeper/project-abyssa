import type { D5Catalog } from "../../../game-core/contracts";
import { FOUR_LAYER_TUTORIAL_CATALOG_DATA } from "../demo-v14/content";

/** A skipped tutorial keeps the guided route's gold, remaining supplies and curio. */
export const STARTER_REWARD_CATALOG_DATA: D5Catalog = {
  ...structuredClone(FOUR_LAYER_TUTORIAL_CATALOG_DATA),
  contentVersion: 15,
  tutorialSkipReward: {
    id: "reward.tide-cave.skip",
    gold: 49,
    supplies: [
      {definitionId: "item.food", charges: 3},
      {definitionId: "item.potion", charges: 2},
    ],
    lootDefinitionIds: ["loot.tutorial.curio"],
  },
};
