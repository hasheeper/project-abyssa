import { expect, it } from "vitest";
import { facilitiesFixture } from "./facilities-fixture";
import { shopFixture, playShopTutorial } from "./shop-foundation-fixture";
import { GameStorageError } from "../index";
import type { D5Command } from "../versions/d5-contracts";
import { FACILITIES_CATALOG } from "../../game-runtime/facilities-context";
import { validateD5Record, validateD5Receipt } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session/d5-run-readers";
import { formalAirpFixture } from "./airp-game-fixture";

async function herbFixture() {
  const f = await facilitiesFixture();
  await f.tick(4); await f.commit({type: "facility-enable", roomId: "greenhouse"}); await f.tick(8);
  await f.commit({type: "facility-collect", roomId: "greenhouse", batchId: f.state().facilities!.batches.greenhouse!.id, quantity: 3});
  await f.commit({type: "facility-enable", roomId: "workshop"}); return f;
}
it("rejects early, stale, unknown and insufficient operations without changing the save", async () => {
  const f = await facilitiesFixture();
  const reject = async (command: D5Command) => {const before = f.read(); expect((await f.send(command)).result.ok).toBe(false); expect(f.read()).toEqual(before);};
  await reject({type: "facility-enable", roomId: "greenhouse"});
  await reject({type: "facility-collect", roomId: "kitchen", batchId: f.state().facilities!.batches.kitchen!.id, quantity: 1});
  await reject({type: "facility-store-return", definitionId: "missing", quantity: 1});
  await f.tick(8); await f.commit({type: "facility-enable", roomId: "workshop"});
  await reject({type: "facility-craft", recipeId: "recipe.potion", quantity: 1});
  const departure = {type: "start-expedition" as const, runId: "invalid-run", routeId: "old-manor.first-clear", partyIds: FACILITIES_CATALOG.data.initialParty, itemIds: ["item.food"], seed: 19};
  await reject({...departure, supplyQuantities: {"item.food": 4}});
  await reject({...departure, supplyQuantities: {"item.potion": 1}});
  await reject({...departure});
  await reject({...departure, itemIds: ["item.food", "item.potion", "item.ward", "item.holy-water", "item.divination-slip"], supplyQuantities: {"item.food": 1, "item.potion": 1, "item.ward": 1, "item.holy-water": 1, "item.divination-slip": 1}});
});
it("preserves partial harvests, stops at storage capacity and changes only the next crop", async () => {
  const f = await facilitiesFixture();
  await f.tick(4);
  const batch = f.state().facilities!.batches.kitchen!;
  const first = await f.commit({type: "facility-collect", roomId: "kitchen", batchId: batch.id, quantity: 1});
  expect(f.state().facilities!.batches.kitchen).toEqual({...batch, remaining: 1});
  expect(await f.runtime.application.dispatch(first.input)).toMatchObject({ok: true, replayed: true});
  expect(f.state().supplies.find(s => s.definitionId === "item.food")!.charges).toBe(4);
  await f.commit({type: "facility-collect", roomId: "kitchen", batchId: batch.id, quantity: 1});
  expect((await f.send({type: "facility-collect", roomId: "kitchen", batchId: batch.id, quantity: 1})).result.ok).toBe(false);
  await f.commit({type: "facility-enable", roomId: "greenhouse"});
  const herb = f.state().facilities!.batches.greenhouse!;
  await f.commit({type: "facility-plant", projectId: "production.clearlight"});
  expect(f.state().facilities!.batches.greenhouse).toEqual(herb);
  for (let n = 0; n < 4; n++) {
    await f.tick(4);
    const b = f.state().facilities!.batches.kitchen!;
    const maximum = f.runtime.queries.journey(f.read())!.facilities!.rooms.find(r => r.id === "kitchen")!.batch!.collectMaximum;
    await f.commit({type: "facility-collect", roomId: "kitchen", batchId: b.id, quantity: maximum});
  }
  expect(f.state().supplies.find(s => s.definitionId === "item.food")!.charges).toBe(12);
  const full = f.read();
  expect((await f.send({type: "facility-collect", roomId: "kitchen", batchId: f.state().facilities!.batches.kitchen!.id, quantity: 1})).result.ok).toBe(false);
  expect(f.read()).toEqual(full);
  await f.commit({type: "facility-collect", roomId: "greenhouse", batchId: herb.id, quantity: 3});
  expect(f.state().facilities!.materials).toEqual({"material.medicinal-herb": 3});
  expect(f.state().facilities!.batches.greenhouse!.projectId).toBe("production.clearlight");
});
it("reserves craft capacity, rejects a second order and blocks shop overfilling", async () => {
  const f = await herbFixture();
  const buy = (quantity: number) => ({type: "purchase-product" as const, shopId: "shop.mansion", productId: "product.item.potion", quantity, day: f.state().clock.day, quoteVersion: 1, scheduleVersion: 1});
  await f.commit(buy(3)); // 5 stored, 6 maximum.
  await f.commit({type: "facility-craft", recipeId: "recipe.potion", quantity: 1});
  const before = f.read(), orderId = f.state().facilities!.order!.id;
  for (const command of [buy(1), {type: "facility-craft" as const, recipeId: "recipe.potion", quantity: 1}, {type: "facility-claim" as const, orderId}]) {
    expect((await f.send(command)).result.ok).toBe(false); expect(f.read()).toEqual(before);
  }
  await f.tick(); await f.commit({type: "facility-claim", orderId});
  expect(f.state().supplies.find(s => s.definitionId === "item.potion")!.charges).toBe(6);
  expect((await f.send({type: "facility-claim", orderId})).result.ok).toBe(false);
});
it.each(["before", "after"] as const)("recovers %s-write faults for harvest, craft and claim exactly once", async when => {
  const original = await herbFixture();
  const ready = original.read();
  await original.commit({type: "facility-craft", recipeId: "recipe.potion", quantity: 1}); await original.tick();
  const completed = original.read();
  const cases: [typeof ready, D5Command][] = [
    [ready, {type: "facility-collect", roomId: "kitchen", batchId: ready.snapshot.campaign.facilities!.batches.kitchen!.id, quantity: 2}],
    [ready, {type: "facility-craft", recipeId: "recipe.potion", quantity: 1}],
    [completed, {type: "facility-claim", orderId: completed.snapshot.campaign.facilities!.order!.id}],
  ];
  for (const [record, command] of cases) {
    const expected = shopFixture(record); await expected.commit(command);
    const f = shopFixture(record), commit = f.store.commit.bind(f.store); let armed = true;
    f.store.commit = async plan => {if (armed) {armed = false; if (when === "after") await commit(plan); throw new GameStorageError("storage-unavailable", "injected");} return commit(plan);};
    const sent = await f.send(command); expect(sent.result.ok).toBe(false);
    expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true});
    expect(f.read().snapshot).toEqual(expected.read().snapshot);
    const after = f.read(); expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true, replayed: true}); expect(f.read()).toEqual(after);
  }
}, 30_000);
it("restores and copies production/order/ready snapshots without advancing their clock", async () => {
  const f = await herbFixture(), snapshots = [f.read()];
  await f.commit({type: "facility-craft", recipeId: "recipe.potion", quantity: 1}); snapshots.push(f.read());
  await f.tick(); snapshots.push(f.read());
  for (const record of snapshots) {
    const source = shopFixture(record), exported = await source.runtime.application.exportSave(source.saveId);
    if (!exported.ok) throw Error("export");
    const target = shopFixture();
    expect(await target.runtime.application.restoreSave({archive: exported.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
    expect(target.read().snapshot).toEqual(record.snapshot);
    const imported = await target.runtime.application.importSave({archive: exported.archive, saveId: "copy", epoch: "copy", clientRequestId: "copy"});
    if (!imported.ok) throw Error(JSON.stringify(imported));
    const copied = await target.runtime.application.open("copy");
    if (!copied.ok) throw Error("copy");
    expect(copied.record.snapshot.campaign).toEqual(record.snapshot.campaign);
  }
}, 30_000);
it("finishes the four-layer tutorial before starting production and grants no extra allowance", async () => {
  const {f, checkpoints} = await playShopTutorial("tutorial", 25);
  expect(checkpoints.created.snapshot.campaign.facilities).toBeNull();
  const c = f.read().snapshot.campaign;
  expect(c.tutorial?.status).toBe("completed");
  expect(c.facilities!.startedAt).toBe(1);
  expect(c.facilities!.batches.kitchen!.readyAt).toBe(5);
  expect(c.supplies.map(s => [s.definitionId, s.charges])).toEqual(c.settlements[0].returnedSupplies.filter(s => s.charges > 0).map(s => [s.definitionId, s.charges]));
  const exported = await f.runtime.application.exportSave(f.saveId); expect(exported.ok).toBe(true);
}, 120_000);
it("binds actual departure quantities to replay and receipt evidence", async () => {
  const f = await facilitiesFixture();
  const sent = await f.commit({type: "start-expedition", runId: "proof-run", routeId: "old-manor.first-clear", partyIds: FACILITIES_CATALOG.data.initialParty, itemIds: ["item.food"], supplyQuantities: {"item.food": 1}, seed: 19});
  if (!sent.result.ok) throw Error("start");
  const receipt = structuredClone(sent.result.receipt);
  if (receipt.version !== 4) throw Error("version");
  const event = receipt.events[0].event;
  if (event.type !== "expedition-started") throw Error("event");
  event.supplyQuantities = {"item.food": 2};
  expect(() => validateD5Receipt(receipt, FACILITIES_CATALOG, D5_RUN_READERS)).toThrow();
  const record = f.read(), fact = record.facts.at(-1)!;
  (fact.payload as typeof event).supplyQuantities = {"item.food": 2};
  expect(() => validateD5Record(record, FACILITIES_CATALOG, D5_RUN_READERS)).toThrow();
});
it("keeps selected quantities through AIRP preparation, permit and departure", async () => {
  const f = await formalAirpFixture("tide-reef.ordinary", 26), id = await f.prepare(), permit = await f.flow.gm.departurePermit(id);
  expect(permit.departure.supplyQuantities).toEqual(f.departure.supplyQuantities);
  await f.send({type: "start-expedition", ...permit.departure});
  expect(f.raw().snapshot.campaign.supplies.find(s => s.definitionId === "item.food")!.charges).toBe(2);
  expect(f.raw().snapshot.campaign.facilities!.reservations).toEqual({"item.food": 1, "item.potion": 1});
  expect((await f.runtime.application.open("formal-airp")).ok).toBe(true);
}, 30_000);

it("uses a crafted potion in a real battle and keeps the unselected stock at home", async () => {
  const f = await herbFixture();
  await f.commit({type: "facility-craft", recipeId: "recipe.potion", quantity: 1}); await f.tick();
  await f.commit({type: "facility-claim", orderId: f.state().facilities!.order!.id});
  await f.commit({type: "start-expedition", runId: "crafted-potion", routeId: "tide-reef.ordinary", partyIds: FACILITIES_CATALOG.data.initialParty, itemIds: ["item.potion"], supplyQuantities: {"item.potion": 1}, seed: 19});
  const {nextD5PlayCommand} = await import("./d5-playthrough");
  for (let step = 0; step < 100; step++) {
    const record = f.read(), view = f.runtime.queries.journey(record)!, supply = view.supplies[0];
    const target = supply?.targets.find(t => t.kind === "member");
    if (target?.kind === "member") {
      const before = view.party.find(m => m.id === target.id)!;
      await f.commit({type: "use-item", runRef: {kind: "expedition", id: "crafted-potion"}, instanceId: supply.instanceId, target});
      const after = f.runtime.queries.journey(f.read())!;
      expect(after.supplies[0].charges).toBe(0);
      expect(after.party.find(m => m.id === target.id)!.hp).toBe(Math.min(before.config.maxHp, before.hp + 2));
      expect(f.state().supplies.find(s => s.definitionId === "item.potion")!.charges).toBe(2);
      expect((await f.runtime.application.open(f.saveId)).ok).toBe(true); return;
    }
    await f.commit(nextD5PlayCommand(FACILITIES_CATALOG, record, true));
  }
  throw Error("No potion target became available");
}, 30_000);
