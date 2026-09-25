import { expect, it } from "vitest";
import { shopFixture, playShopTutorial } from "./shop-foundation-fixture";
import { GameStorageError } from "../index";

async function start(startAt: "hub" | "debug-shop" = "hub") {
  const f = shopFixture();
  expect(await f.runtime.application.createNewGame({saveId: f.saveId, epoch: "copper", clientRequestId: "create", startAt})).toMatchObject({ok: true});
  return f;
}
const trade = (f: ReturnType<typeof shopFixture>, suffix: string, type: "appraise-loot" | "sell-loot") => ({
  type, shopId: "shop.mansion", quoteVersion: 2,
  instanceId: f.read().snapshot.campaign.loot!.find(i => i.definitionId === `loot.tutorial.${suffix}`)!.instanceId,
});

it("settles the full four-layer copper tutorial into the same starting assets as skipping", async () => {
  const {f} = await playShopTutorial("tutorial", 17);
  const skipped = await start(), campaign = f.read().snapshot.campaign;
  expect(campaign.funds.party).toBe(4400);
  expect(campaign.loot!.map(i => [i.definitionId, i.resultId])).toEqual(skipped.read().snapshot.campaign.loot!.map(i => [i.definitionId, i.resultId]));
  expect(f.runtime.queries.shop(f.read())?.introduction).toMatchObject({step: 0});
  expect(skipped.runtime.queries.shop(skipped.read())?.introduction).toBeNull();
  const debug = await start("debug-shop");
  expect(debug.runtime.queries.shop(debug.read())?.introduction).toMatchObject({step: 0});
}, 180_000);

it("commits free appraisal, batch sale and paid supplies with exact recovery and no duplicate effects", async () => {
  const f = await start();
  const appraisal = await f.commit(trade(f, "barrier-nail", "appraise-loot"));
  expect(f.read().snapshot.campaign.funds.party).toBe(4400);
  expect(await f.runtime.application.dispatch(appraisal.input)).toMatchObject({ok: true, replayed: true});
  expect((await f.send(appraisal.input.command)).result.ok).toBe(false);
  await f.commit(trade(f, "barrier-nail", "sell-loot"));
  expect(f.read().snapshot.campaign.funds.party).toBe(4900);
  const batch = await f.commit(trade(f, "cross-coins", "sell-loot"));
  expect(f.read().snapshot.campaign.funds.party).toBe(6702);
  expect(f.read().snapshot.campaign.loot!.map(i => i.definitionId)).toEqual(["loot.tutorial.black-bread"]);
  expect(f.read().snapshot.campaign.lootTrades!.filter(t => t.kind === "sell").map(t => t.gold)).toEqual([500, 1800, 2]);
  expect(await f.runtime.application.dispatch(batch.input)).toMatchObject({ok: true, replayed: true});
  const before = f.read();
  expect((await f.send(trade(f, "black-bread", "sell-loot"))).result.ok).toBe(false);
  expect(f.read()).toEqual(before);
  for (const [definitionId, quantity] of [["item.ward", 2], ["item.holy-water", 2], ["item.maintenance-kit", 1], ["item.lucky-charm", 1], ["item.divination-slip", 2]] as const)
    await f.commit({type: "purchase-product", shopId: "shop.mansion", quoteVersion: 1, scheduleVersion: 1, productId: `product.${definitionId}`, day: 1, quantity});
  expect(f.read().snapshot.campaign.funds).toEqual({party: 3302, public: 0, crystals: 0});
  const exported = await f.runtime.application.exportSave(f.saveId);
  if (!exported.ok) throw Error("export");
  expect(await f.runtime.application.importSave({saveId: "copper-copy", epoch: "copy", clientRequestId: "copy", archive: exported.archive})).toMatchObject({ok: true});
  const copy = await f.runtime.application.open("copper-copy");
  if (!copy.ok) throw Error("copy");
  expect(copy.record.snapshot.campaign.funds).toEqual(f.read().snapshot.campaign.funds);
  expect(await shopFixture(f.read()).runtime.application.open(f.saveId)).toEqual({ok: true, record: f.read()});
}, 30_000);

it.each(["before", "after"])("recovers a %s-commit failure without duplicating the coin lot or its attached scrap", async when => {
  const f = await start(), commit = f.store.commit.bind(f.store);
  let armed = true;
  f.store.commit = async plan => {
    if (armed) {armed = false; if (when === "after") await commit(plan); throw new GameStorageError("storage-unavailable", "injected");}
    return commit(plan);
  };
  const sent = await f.send(trade(f, "cross-coins", "sell-loot"));
  expect(sent.result.ok).toBe(false);
  expect(await f.runtime.application.dispatch(sent.input)).toMatchObject({ok: true});
  expect(f.read().snapshot.campaign.funds.party).toBe(6202);
  expect(f.read().snapshot.campaign.lootTrades).toHaveLength(2);
});
