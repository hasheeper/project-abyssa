import { COPPER_ECONOMY_CATALOG_DATA } from "../../content/gameplay/demo-v17/content";
import { validateD5Catalog } from "../../game-core/contracts/d5-validation";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createD5Application } from "../versions/d5-service";
import type { D5Command, D5GameRecord, D5Receipt } from "../versions/d5-contracts";

/** Test content only: real room grants, no mutation of combat or persisted state. */
const data = structuredClone(COPPER_ECONOMY_CATALOG_DATA);
const routeId = data.manor!.firstClearRouteId;
data.loot!.definitions["loot.test.salvage"] = {id: "loot.test.salvage", resultId: "known.test.salvage", initiallyKnown: true, appraisalFee: 0, salePrice: 260};
data.loot!.definitions["loot.test.curio"] = {id: "loot.test.curio", resultId: "known.test.curio", appraisalFee: 300, salePrice: 600, scrapPrice: 2};
data.routes[routeId].layers.forEach((rooms, layer) => {
  rooms.filter(id => data.journey!.rooms[id].kind !== "exit").forEach((roomId, index) => {
    data.loot!.grants.push({id: `grant.test.${layer}.${index}`, routeId, roomId, definitionId: index ? "loot.test.curio" : "loot.test.salvage"});
  });
});
export const ordinaryLootCatalog = validateD5Catalog(data);

export async function ordinaryLootFixture(withUnbankedRoom = false) {
  let catalog = ordinaryLootCatalog;
  if (withUnbankedRoom) {
    const extended = structuredClone(data), rooms = extended.routes[routeId].layers[1];
    const source = extended.journey!.rooms[rooms[0]];
    const roomId = "room.test.second-battle";
    extended.journey!.rooms[roomId] = {...source, id: roomId};
    rooms.splice(1, 0, roomId);
    catalog = validateD5Catalog(extended);
  }
  const db = new MemoryGameDatabase<D5GameRecord, D5Receipt>(), store = new MemoryGameStore(db);
  const app = createD5Application(catalog, store);
  const saveId = "ordinary-loot", runId = "ordinary-run";
  const created = await app.create({protocolVersion: 4, saveId, epoch: "epoch", clientRequestId: "create", profileId: data.journey!.defaultProfileId});
  if (!created.ok) throw Error(JSON.stringify(created));
  let id = 0;
  const read = () => structuredClone(db.records.get(saveId)!);
  const send = async (command: D5Command) => {
    const request = {protocolVersion: 4, saveId, expectedHead: read().head, clientRequestId: `loot:${++id}`, command};
    const result = await (command.type === "resume-run" ? app.resumeRun(request) : app.dispatch(request));
    if (!result.ok) throw Error(JSON.stringify(result));
    return {request, result};
  };
  await send({type: "select-game-start", startAt: "hub"});
  await send({type: "start-expedition", runId, routeId, partyIds: data.initialParty, itemIds: data.journey!.defaultItems, seed: 19});
  return {db, store, app, read, send, runId, catalog};
}
