import type { BattleContext } from "../game-core/contracts";
import { LEGACY_CATALOG } from "../content/gameplay/legacy-v1/catalog";
import { validateCatalog } from "../game-core/contracts";
import { LEGACY_MANIFEST } from "../content/gameplay/legacy-v1/manifest";
export const LEGACY_VALIDATED_CATALOG = validateCatalog(
  LEGACY_CATALOG,
  LEGACY_MANIFEST,
);
export const LEGACY_CONTEXT: BattleContext = {
  catalog: LEGACY_VALIDATED_CATALOG.data,
  partyOrder: LEGACY_CATALOG.defaultParty,
  routeId: LEGACY_CATALOG.defaultRouteId,
  legacy: true,
};
