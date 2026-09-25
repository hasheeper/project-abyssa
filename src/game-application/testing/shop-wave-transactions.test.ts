import { expect, it } from "vitest";
import { shopWaveFixture } from "./shop-wave-fixture";
import { GameStorageError } from "../index";
import { equipmentTargets } from "../../game-core/contracts/equipment";

it.each(["before", "after"])("recovers a %s-commit equipment purchase without partial or duplicate delivery", async when => {
  const f = await shopWaveFixture(); await f.day(2);
  const before = f.read(), commit = f.store.commit.bind(f.store);
  let armed = true;
  f.store.commit = async plan => {
    if (armed) {armed = false; if (when === "after") await commit(plan); throw new GameStorageError("storage-unavailable", "injected");}
    return commit(plan);
  };
  const sent = await f.send(f.quote("iron-bracer"));
  if (when === "before") expect(f.read()).toEqual(before);
  const retried = await f.runtime.application.dispatch(sent.input);
  expect(retried.ok).toBe(true);
  expect(f.read().snapshot.campaign.funds.party).toBe(3120);
  expect(f.read().snapshot.campaign.inventory).toHaveLength(1);
  expect(f.read().snapshot.campaign.shop!.purchases).toEqual({"product.equipment.iron-bracer": 1});
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true, replayed: true});
  expect(f.read().snapshot.campaign.inventory).toHaveLength(1);
});

it("requires the recipient's native face on transfer, and enforces occupied slots and real supply capacity", async () => {
  const f = await shopWaveFixture(); await f.day(2); await f.commit(f.quote("iron-bracer"));
  const item = f.read().snapshot.campaign.inventory[0], def = f.catalog.data.equipment[item.definitionId];
  const kael = equipmentTargets(f.catalog.data, "kael", def)[0].id, eustice = equipmentTargets(f.catalog.data, "eustice", def)[0].id;
  const equip = {type: "equip-equipment" as const, instanceId: item.instanceId, ownerId: "kael", targetFaceId: kael};
  await f.commit(equip);
  const transfer = {type: "transfer-equipment" as const, instanceId: item.instanceId, fromOwnerId: "kael", toOwnerId: "eustice", targetFaceId: kael};
  const before = f.read();
  expect((await f.send(transfer)).result.ok).toBe(false); expect(f.read()).toEqual(before);
  await f.commit({...transfer, targetFaceId: eustice});
  expect(f.read().snapshot.campaign.progress.equipment[0]).toMatchObject({ownerId: "eustice", targetFaceId: eustice});
  await f.commit(f.quote("spare-blade"));
  const blade = f.read().snapshot.campaign.inventory[1];
  expect((await f.send({type: "equip-equipment", instanceId: blade.instanceId, ownerId: "eustice"})).result.ok).toBe(false);
  const supply = {...f.quote(""), productId: "product.item.ward", quantity: 2};
  await f.commit(supply);
  expect(f.read().snapshot.campaign.supplies.find(s => s.definitionId === "item.ward")?.charges).toBe(2);
  expect((await f.send({...supply, quantity: 1})).result).toMatchObject({ok: false, error: {code: "inventory-full"}});
});
