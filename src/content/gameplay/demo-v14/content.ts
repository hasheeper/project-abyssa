import type { D5Catalog } from "../../../game-core/contracts";
import { SHOP_FOUNDATION_CATALOG_DATA } from "../demo-v13/content";

const previous = structuredClone(SHOP_FOUNDATION_CATALOG_DATA);

/** Four real tutorial layers, with ordinary settlement and recovery rules. */
export const FOUR_LAYER_TUTORIAL_CATALOG_DATA: D5Catalog = {
  ...previous,
  contentVersion: 14,
  routes: {
    ...previous.routes,
    "intro.tide-cave.first": {
      id: "intro.tide-cave.first",
      layers: [
        ["room.tide-cave.1"],
        ["room.tide-cave.2", "room.tide-cave.event.intro"],
        ["room.tide-cave.3"],
        ["room.tide-cave.4"],
      ],
    },
  },
  tutorial: {
    ...previous.tutorial!,
    guide: {...previous.tutorial!.guide!, id: "tide.guide.v3"},
  },
};
