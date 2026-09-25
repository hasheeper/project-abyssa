import type { ValidatedD5Catalog } from "../contracts/d5";
import { earnedLoot } from "../contracts/loot";
import { CURIO_RARITIES, parseAppraisalSlots, type AppraisalSlot } from "../contracts/expedition-appraisal";
import { createBattleRngState } from "../battle/persistence/rng";
import type { D5Departure } from "./d5-journey-contracts";

/** Read-only forecast of existing addressed draws. No completion facts, inventory or RNG cursor writes. */
export function expeditionAppraisalSlots(catalog: ValidatedD5Catalog, departure: Pick<D5Departure, "runId" | "routeId" | "seed">): AppraisalSlot[] {
  const {runId, routeId, seed} = departure, content = catalog.data.loot;
  if (!content?.dropTables || routeId === catalog.data.tutorial?.routeId) return [];
  const roomIds = catalog.data.routes[routeId].layers.flatMap((rooms, l) => rooms.map((_, r) => `${runId}:room:${l + 1}:${r + 1}`));
  const drops = earnedLoot(content, catalog.data.routes, runId, routeId, roomIds, createBattleRngState(seed).loot.seed);
  return parseAppraisalSlots(drops.filter(d => d.grantId.endsWith(":curio")).map(d => {
    const definition = content.definitions[d.definitionId], binding = content.dropTables!.rooms.find(r => `drop:${r.id}:curio` === d.grantId)!;
    return {key: d.grantId, instanceId: d.instanceId, grantId: d.grantId, baseDefinitionId: d.definitionId,
      roomId: d.roomId, roomDefinitionId: binding.roomId, rarity: CURIO_RARITIES[d.definitionId],
      appraisalFee: definition.appraisalFee, salePrice: definition.salePrice, scrapPrice: definition.scrapPrice};
  }));
}
