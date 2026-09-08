import type { D5Catalog } from "../../../game-core/contracts";
import { PROLOGUE_CATALOG_DATA } from "../demo-v4/content";

/** Content v4 stays frozen. Rules/protocol stay v4; only the opening content advances. */
export const FIRST_MORNING_CATALOG_DATA: D5Catalog = {
  ...structuredClone(PROLOGUE_CATALOG_DATA),
  contentVersion: 5,
  opening: {id:"opening.first-morning",lastStep:66,choiceSteps:[6,24,42,58]},
};
