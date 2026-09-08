import type { D5Catalog } from "../../../game-core/contracts";
import { FIRST_MORNING_CATALOG_DATA } from "../demo-v5/content";

/** Append S2 without changing v5's saved cursor boundary or content digest. */
export const MORNING_DEPARTURE_CATALOG_DATA: D5Catalog = {
  ...structuredClone(FIRST_MORNING_CATALOG_DATA),
  contentVersion: 6,
  opening: {
    id:"opening.first-morning", lastStep:119, choiceSteps:[6,24,42,58,96],
    choiceOptions:{"6":["A","B","C"],"24":["A","B","C"],"42":["A","B","C"],"58":["A","B","C"],"96":["A","B"]},
  },
};
