import type { D5Catalog } from "../../../game-core/contracts";
import { ORDINARY_DROPS_CATALOG_DATA } from "../demo-v21/content";
import { AIRP_DIRECTOR_CATALOG_DATA } from "../demo-v19/content";

/** Opt-in formal AIRP game. Neither existing content21 nor old AIRP saves are migrated. */
export const AIRP_GAME_CATALOG_DATA: D5Catalog = {
  ...structuredClone(ORDINARY_DROPS_CATALOG_DATA), contentVersion: 22,
  airpDirector: structuredClone(AIRP_DIRECTOR_CATALOG_DATA.airpDirector!),
};
