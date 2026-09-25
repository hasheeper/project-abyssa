import { expect, it } from "vitest";
import { facilitiesFixture } from "./facilities-fixture";
import { shopFixture } from "./shop-foundation-fixture";
import { quoteConstruction } from "../../game-core/session/facility-construction";
import { ESTATE_CATALOG } from "../../game-runtime/estate-context";
import { productQuote } from "../../game-core/session/shop-schedule";
import type { FacilityId, FacilityLevel } from "../../game-core/contracts/facilities";
import type { D5Command } from "../versions/d5-contracts";
import { GameStorageError } from "../index";
import { validateD5Record } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session/d5-run-readers";

const build = (roomId: FacilityId, fromLevel: FacilityLevel, quotedCost: number): D5Command => ({type: "facility-build", roomId, fromLevel, quotedCost});
const reject = async (f: Awaited<ReturnType<typeof facilitiesFixture>>, command: D5Command) => {
  const before = f.read(); expect((await f.send(command)).result.ok).toBe(false); expect(f.read()).toEqual(before);
};

it("quotes the approved repair/upgrade table and maid discount without self-discounts", async () => {
  const f = await facilitiesFixture(27), content = ESTATE_CATALOG.data.facilities!, state = structuredClone(f.state().facilities!);
  const prices: [FacilityId, number[]][] = [["kitchen", [50_000, 200_000, 400_000]], ["greenhouse", [65_000, 260_000, 520_000]], ["workshop", [60_000, 240_000, 480_000]], ["storage", [75_000, 300_000, 600_000]], ["maid", [20_000, 80_000, 160_000]]];
  for (const [id, expected] of prices) for (const level of [0, 1, 2] as const) {
    state.levels.maid = 0; state.levels[id] = level;
    expect(quoteConstruction(content, state, id, content.construction!.basePrices[id], 9)).toMatchObject({cost: expected[level], fromLevel: level, toLevel: level + 1, readyAt: [11, 13, 17][level]});
  }
  state.levels.kitchen = 1; state.levels.maid = 3;
  expect(quoteConstruction(content, state, "kitchen", 200_001, 0).cost).toBe(170_001);
});

it("pays once, runs one project, and activates capacity/production only at completion", async () => {
  const f = await facilitiesFixture(27), party = f.state().funds.party, batch = f.state().facilities!.batches.kitchen;
  const sent = await f.commit(build("kitchen", 1, 200_000));
  expect(f.state().funds).toMatchObject({public: 300_000, party});
  expect(f.state().facilities!.levels.kitchen).toBe(1);
  await reject(f, build("storage", 1, 300_000));
  await reject(f, build("kitchen", 1, 200_000));
  await f.tick(3); expect(f.state().facilities!.levels.kitchen).toBe(1);
  expect(f.state().facilities!.construction?.cost).toBe(200_000);
  await f.tick(); expect(f.state().facilities!.levels.kitchen).toBe(2);
  expect(f.state().facilities!.batches.kitchen).toEqual(batch);
  await f.commit({type: "facility-collect", roomId: "kitchen", batchId: batch!.id, quantity: 2});
  expect(f.state().facilities!.batches.kitchen!.remaining).toBe(3);
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true, replayed: true});
  await reject(f, build("kitchen", 1, 200_000)); // A delayed double click cannot purchase Lv3.
  await f.commit(build("storage", 1, 300_000));
  expect(f.runtime.queries.journey(f.read())!.facilities!.itemLimit).toBe(4);
  await f.tick(4);
  expect(f.runtime.queries.journey(f.read())!.facilities!.itemLimit).toBe(5);
  expect(f.state().funds.public).toBe(0);
  await reject(f, build("kitchen", 2, 400_000)); // Party funds cannot pay construction.
  expect(f.state().funds.party).toBe(party);
});

it("requires initial repairs on unlock days, applies maid benefits, and rejects stale prices", async () => {
  const f = await facilitiesFixture(27);
  await reject(f, build("greenhouse", 0, 65_000));
  await f.tick(4); await reject(f, {type: "facility-enable", roomId: "greenhouse"});
  await f.commit(build("greenhouse", 0, 65_000));
  expect(f.state().facilities!.levels.greenhouse).toBe(0);
  expect(f.state().facilities!.batches.greenhouse).toBeUndefined();
  await f.tick(2);
  expect(f.state().facilities!.batches.greenhouse).toMatchObject({readyAt: 14, remaining: 3});
  await f.tick(6); await f.commit(build("maid", 0, 20_000)); await f.tick(2);
  await reject(f, build("kitchen", 1, 200_000));
  await f.commit(build("maid", 1, 80_000)); await f.tick(4);
  expect(f.runtime.queries.journey(f.read())!.facilities!.discount).toBe(10);
  await f.commit(build("kitchen", 1, 180_000));
  expect(f.state().facilities!.construction?.cost).toBe(180_000);
});

it("keeps workshop orders and construction mutually exclusive, with crafting paid from party funds", async () => {
  const f = await facilitiesFixture(27); await f.tick(4);
  await f.commit(build("greenhouse", 0, 65_000)); await f.tick(4);
  await f.commit(build("workshop", 0, 60_000)); await f.tick(6);
  await f.commit({type: "facility-collect", roomId: "greenhouse", batchId: f.state().facilities!.batches.greenhouse!.id, quantity: 3});
  const before = f.state().funds;
  await f.commit({type: "facility-craft", recipeId: "recipe.potion", quantity: 1});
  expect(f.state().funds).toMatchObject({public: before.public, party: before.party - 100});
  await reject(f, build("workshop", 1, 240_000)); await f.tick();
  await reject(f, build("workshop", 1, 240_000)); // Finished but unclaimed is still occupied.
  await f.commit({type: "facility-claim", orderId: f.state().facilities!.order!.id});
  await f.commit(build("workshop", 1, 240_000));
  await reject(f, {type: "facility-craft", recipeId: "recipe.potion", quantity: 1});
  expect(f.runtime.queries.journey(f.read())!.facilities!.recipes[0].maximum).toBe(0);
  const noPrivateMoney = structuredClone(f.state()); noPrivateMoney.funds.party = 0;
  expect(() => productQuote(ESTATE_CATALOG, noPrivateMoney, {shopId: "shop.mansion", productId: "product.item.potion", quantity: 1, day: noPrivateMoney.clock.day, quoteVersion: 1, scheduleVersion: 1})).toThrow();
});

it.each(["before", "after"] as const)("recovers a %s-write construction fault with exactly one debit", async when => {
  const initial = await facilitiesFixture(27), f = shopFixture(initial.read()), command = build("kitchen", 1, 200_000), expected = shopFixture(initial.read());
  await expected.commit(command);
  const commit = f.store.commit.bind(f.store); let armed = true;
  f.store.commit = async plan => {if (armed) {armed = false; if (when === "after") await commit(plan); throw new GameStorageError("storage-unavailable", "injected");} return commit(plan);};
  const sent = await f.send(command); expect(sent.result.ok).toBe(false);
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true});
  expect(f.read().snapshot).toEqual(expected.read().snapshot);
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true, replayed: true});
  expect(f.read().snapshot.campaign.funds.public).toBe(300_000);
});

it("restores construction in progress without early upgrades and rejects edited funding or levels", async () => {
  const f = await facilitiesFixture(27); await f.commit(build("storage", 1, 300_000)); await f.tick(2);
  const saved = f.read(), exported = await f.runtime.application.exportSave(f.saveId);
  if (!exported.ok) throw Error("export");
  const target = shopFixture();
  expect(await target.runtime.application.restoreSave({archive: exported.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
  expect(target.read().snapshot).toEqual(saved.snapshot);
  await target.commit({type: "advance-phase"});
  expect(target.read().snapshot.campaign.facilities!.levels.storage).toBe(1);
  await target.commit({type: "advance-phase"});
  expect(target.read().snapshot.campaign.facilities!.levels.storage).toBe(2);
  expect(target.read().snapshot.campaign.funds.public).toBe(200_000);
  const forged = structuredClone(saved); forged.snapshot.campaign.facilities!.levels.storage = 3;
  expect(() => validateD5Record(forged, ESTATE_CATALOG, D5_RUN_READERS)).toThrow();
  forged.snapshot = structuredClone(saved.snapshot); forged.snapshot.campaign.facilities!.funding!.paidThroughWeek++;
  expect(() => validateD5Record(forged, ESTATE_CATALOG, D5_RUN_READERS)).toThrow();
});
