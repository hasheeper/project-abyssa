import type { D5Catalog } from "../../../game-core/contracts";
import { SHOP_WAVE_CATALOG_DATA } from "../demo-v23/content";
import { AIRP_GAME_CATALOG_DATA } from "../demo-v22/content";
/** Same deterministic shop as ordinary saves; formal AIRP remains opt-in. */
export const SHOP_AIRP_CATALOG_DATA: D5Catalog = {...structuredClone(SHOP_WAVE_CATALOG_DATA), contentVersion: 24,
  airpDirector: structuredClone(AIRP_GAME_CATALOG_DATA.airpDirector!),
};
