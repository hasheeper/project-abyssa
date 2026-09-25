import type { D5Catalog } from "../../../game-core/contracts";
import { COPPER_ECONOMY_CATALOG_DATA } from "../demo-v17/content";
import { DIRECT_FOLLOWUP } from "./followup";

/** Opt-in static AIRP release. Ordinary new games and existing catalogs stay unchanged. */
export const AIRP_DIRECT_CATALOG_DATA: D5Catalog = {
  ...structuredClone(COPPER_ECONOMY_CATALOG_DATA), contentVersion: 18,
  airpDirect: {version: 1, definitionId: "ripple.elora.old-medicine-case",
    demoStart: {id: "start.airp.patrol", routeId: COPPER_ECONOMY_CATALOG_DATA.manor!.maintenanceRouteId}, followup: DIRECT_FOLLOWUP},
};
