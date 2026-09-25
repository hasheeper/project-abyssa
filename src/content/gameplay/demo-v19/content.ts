import type { D5Catalog } from "../../../game-core/contracts";
import { COPPER_ECONOMY_CATALOG_DATA } from "../demo-v17/content";
import { DIRECTOR_CAPABILITIES, DIRECTOR_FIXED_CARDS, directorAuthorSource } from "../airp-director/content";

/** Opt-in director workflow; working drafts are not approved story content. */
export const AIRP_DIRECTOR_CATALOG_DATA: D5Catalog = {
  ...structuredClone(COPPER_ECONOMY_CATALOG_DATA), contentVersion: 19,
  airpDirector: {version: 1, fixed: DIRECTOR_FIXED_CARDS, capabilities: DIRECTOR_CAPABILITIES,
    authorSources: DIRECTOR_FIXED_CARDS.map(f => ({id: f.sourceId, body: directorAuthorSource(f.sourceId), digest: f.sourceDigest})),
    demoStart: {id: "start.airp.patrol", routeId: COPPER_ECONOMY_CATALOG_DATA.manor!.maintenanceRouteId}},
};
