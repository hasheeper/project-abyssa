import type { D5Catalog } from "../contracts/d5";
import type { D5Projection } from "./d5-types";
import { hasManorPatrolAccess } from "./game-start";

export function isOrdinaryExpedition(catalog: D5Catalog, routeId: string) {
  return routeId === catalog.manor?.firstClearRouteId || routeId === catalog.manor?.maintenanceRouteId || !!catalog.expeditions?.[routeId];
}

/** Used by departure, fact replay and the runtime's read-only map projection. */
export function ordinaryExpeditionAvailable(catalog: D5Catalog, campaign: Pick<D5Projection, "manor" | "airpDemoStart" | "tutorial">, routeId: string) {
  if (campaign.tutorial && !["completed", "exempt"].includes(campaign.tutorial.status)) return false;
  if (catalog.expeditions?.[routeId]) return true;
  return routeId === (hasManorPatrolAccess(campaign) ? catalog.manor?.maintenanceRouteId : catalog.manor?.firstClearRouteId);
}

export function ordinaryReturnGrantsGrowth(catalog: D5Catalog, routeId: string) {
  return catalog.expeditions?.[routeId]?.grantsGrowth ?? (routeId === catalog.manor?.firstClearRouteId || routeId === catalog.manor?.maintenanceRouteId);
}
